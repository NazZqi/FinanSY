//! Login con Google vía Supabase Auth (flujo PKCE hecho en el servidor) y sesión propia en cookie cifrada.
//! No se guardan ni refrescan los tokens de Supabase: solo sirven para saber quién es la persona.

use axum::extract::{FromRef, FromRequestParts, Query, State};
use axum::http::request::Parts;
use axum::response::{IntoResponse, Redirect, Response};
use axum_extra::extract::cookie::{Cookie, Key, PrivateCookieJar, SameSite};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::Utc;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use url::Url;
use uuid::Uuid;

use crate::AppState;
use crate::db;
use crate::error::{AppResult, bad};

const SESSION: &str = "finansy_sesion";
const PKCE: &str = "finansy_pkce";
const SESSION_DAYS: i64 = 30;

#[derive(Debug, Clone)]
pub struct CurrentUser {
    pub id: Uuid,
    pub name: String,
}

/// Usuario si hay sesión; para páginas públicas.
pub struct MaybeUser(pub Option<CurrentUser>);

pub fn session_cookie(id: Uuid, name: &str, secure: bool) -> Cookie<'static> {
    Cookie::build((SESSION, format!("{id}|{}|{name}", Utc::now().timestamp())))
        .path("/")
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(SESSION_DAYS))
        .build()
}

fn parse_session(value: &str) -> Option<CurrentUser> {
    let mut parts = value.splitn(3, '|');
    let id = parts.next()?.parse().ok()?;
    let issued: i64 = parts.next()?.parse().ok()?;
    let name = parts.next()?.to_string();
    let age = Utc::now().timestamp() - issued;
    (0..SESSION_DAYS * 86_400).contains(&age).then_some(CurrentUser { id, name })
}

impl<S> FromRequestParts<S> for CurrentUser
where
    Key: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Response> {
        let Ok(jar) = PrivateCookieJar::<Key>::from_request_parts(parts, state).await;
        if let Some(user) = jar.get(SESSION).and_then(|c| parse_session(c.value())) {
            return Ok(user);
        }
        let next = parts.uri.path_and_query().map_or("/", |p| p.as_str());
        let login = format!("/entrar?next={}", url::form_urlencoded::byte_serialize(next.as_bytes()).collect::<String>());
        // Una petición de HTMX no puede seguir la redirección a otro dominio: se pide navegación completa.
        if parts.headers.contains_key("hx-request") {
            return Err(([("hx-redirect", login)], "").into_response());
        }
        Err(Redirect::to(&login).into_response())
    }
}

impl<S> FromRequestParts<S> for MaybeUser
where
    Key: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let Ok(jar) = PrivateCookieJar::<Key>::from_request_parts(parts, state).await;
        Ok(MaybeUser(jar.get(SESSION).and_then(|c| parse_session(c.value()))))
    }
}

/// Solo rutas internas: evita redirigir a otro sitio después del login.
fn safe_next(next: Option<&str>) -> String {
    match next {
        Some(n)
            if n.starts_with('/')
                && !n.starts_with("//")
                && !n.contains('\\')
                && !n.contains('|')
                && !n.chars().any(char::is_control) =>
        {
            n.to_string()
        }
        _ => "/jarrones".to_string(),
    }
}

#[derive(Deserialize)]
pub struct NextQuery {
    next: Option<String>,
}

fn has_session(jar: &PrivateCookieJar) -> bool {
    jar.get(SESSION).and_then(|c| parse_session(c.value())).is_some()
}

pub async fn entrar(State(st): State<AppState>, jar: PrivateCookieJar, Query(q): Query<NextQuery>) -> AppResult<Response> {
    let next = safe_next(q.next.as_deref());
    // Con sesión abierta no hace falta pasar por Google.
    if has_session(&jar) {
        return Ok(Redirect::to(&next).into_response());
    }
    let verifier = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));

    let mut url = Url::parse(&format!("{}/auth/v1/authorize", st.config.supabase_url))?;
    url.query_pairs_mut()
        .append_pair("provider", "google")
        .append_pair("redirect_to", &format!("{}/auth/callback", st.config.base_url))
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "s256");

    let cookie = Cookie::build((PKCE, format!("{verifier}|{next}")))
        .path("/auth")
        .http_only(true)
        .secure(st.config.base_url.starts_with("https://"))
        .same_site(SameSite::Lax)
        .max_age(time::Duration::minutes(10))
        .build();
    Ok((jar.add(cookie), Redirect::to(url.as_str())).into_response())
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    user: SupabaseUser,
}

#[derive(Deserialize)]
struct SupabaseUser {
    id: Uuid,
    email: Option<String>,
    #[serde(default)]
    user_metadata: UserMetadata,
}

#[derive(Deserialize, Default)]
struct UserMetadata {
    full_name: Option<String>,
    name: Option<String>,
    avatar_url: Option<String>,
    picture: Option<String>,
}

pub async fn callback(State(st): State<AppState>, jar: PrivateCookieJar, Query(q): Query<CallbackQuery>) -> AppResult<Response> {
    // Si otro inicio en paralelo (otra pestaña, doble clic) ya abrió la sesión, se entra igual.
    let logged_in = has_session(&jar);
    let Some(code) = q.code else {
        tracing::warn!(error = ?q.error_description, "login rechazado por Supabase");
        return if logged_in { Ok(Redirect::to("/jarrones").into_response()) } else { Err(bad("No se pudo iniciar sesión con Google. Vuelve a intentarlo.")) };
    };
    let Some((verifier, next)) = jar.get(PKCE).and_then(|c| c.value().split_once('|').map(|(v, n)| (v.to_string(), n.to_string()))) else {
        if logged_in {
            return Ok(Redirect::to("/jarrones").into_response());
        }
        return Err(bad("El inicio de sesión expiró. Vuelve a intentarlo."));
    };

    let response = st
        .http
        .post(format!("{}/auth/v1/token?grant_type=pkce", st.config.supabase_url))
        .header("apikey", &st.config.supabase_key)
        .json(&serde_json::json!({ "auth_code": code, "code_verifier": verifier }))
        .send()
        .await?;
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "Supabase rechazó el intercambio PKCE");
        // Otra pestaña pisó la cookie PKCE y ya entró: esta llegó tarde, pero hay sesión.
        if logged_in {
            return Ok(Redirect::to("/jarrones").into_response());
        }
        return Err(bad("No se pudo iniciar sesión con Google. Vuelve a intentarlo."));
    }
    let token: TokenResponse = response.json().await?;
    let meta = token.user.user_metadata;
    let email_name = token.user.email.as_deref().and_then(|e| e.split('@').next()).map(str::to_string);
    let name: String = meta
        .full_name
        .or(meta.name)
        .or(email_name)
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "Sin nombre".to_string())
        .chars()
        .take(80)
        .collect();
    let avatar = meta.avatar_url.or(meta.picture).filter(|u| u.starts_with("https://") && u.len() <= 500);

    db::upsert_profile(&st.pool, token.user.id, &name, avatar.as_deref()).await?;
    let jar = jar
        .remove(Cookie::build(PKCE).path("/auth"))
        .add(session_cookie(token.user.id, &name, st.config.base_url.starts_with("https://")));
    Ok((jar, Redirect::to(&safe_next(Some(&next)))).into_response())
}

pub async fn salir(jar: PrivateCookieJar) -> (PrivateCookieJar, Redirect) {
    (jar.remove(Cookie::build(SESSION).path("/")), Redirect::to("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_solo_acepta_rutas_internas() {
        assert_eq!(safe_next(Some("/unirse/abc")), "/unirse/abc");
        assert_eq!(safe_next(Some("//evil.com")), "/jarrones");
        assert_eq!(safe_next(Some("https://evil.com")), "/jarrones");
        assert_eq!(safe_next(Some("/\\evil.com")), "/jarrones");
        // El navegador borra tabs y saltos de línea en Location: "/\t/evil.com" termina en "//evil.com".
        assert_eq!(safe_next(Some("/\t/evil.com")), "/jarrones");
        assert_eq!(safe_next(Some("/\n/evil.com")), "/jarrones");
        assert_eq!(safe_next(None), "/jarrones");
    }

    #[test]
    fn sesion_vencida_o_mal_formada_no_vale() {
        let id = Uuid::new_v4();
        let now = Utc::now().timestamp();
        assert!(parse_session(&format!("{id}|{now}|Ana|Pérez")).is_some_and(|u| u.name == "Ana|Pérez"));
        assert!(parse_session(&format!("{id}|{}|Ana", now - 31 * 86_400)).is_none());
        assert!(parse_session("no-es-uuid|1|Ana").is_none());
    }
}

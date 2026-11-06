//! Login con Nextcloud vía OpenID Connect (app "OIDC Identity Provider", flujo PKCE hecho en el servidor)
//! y sesión propia en cookie cifrada. No se guardan los tokens de Nextcloud: solo sirven para saber quién es la persona.

use axum::extract::{FromRef, FromRequestParts, Query, State};
use axum::http::header::CONTENT_TYPE;
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
/// Cookie de cada inicio de sesión en curso. El nombre lleva el `state`, así varios inicios en
/// paralelo (dos pestañas, doble clic, vistas de varios dispositivos) no se pisan entre sí.
const PKCE_PREFIX: &str = "finansy_pkce_";
const SESSION_DAYS: i64 = 30;
const MSG_FALLO: &str = "No se pudo iniciar sesión con Nextcloud. Vuelve a intentarlo.";
/// Espacio de nombres fijo: el mismo `sub` de Nextcloud siempre da el mismo UUID de perfil.
const PERFIL_NS: Uuid = Uuid::from_u128(0xc6c43768_c554_4087_8a14_13a474f6cc2e);

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

/// UUID de perfil estable a partir del identificador de usuario de Nextcloud.
fn perfil_id(sub: &str) -> Uuid {
    Uuid::new_v5(&PERFIL_NS, sub.as_bytes())
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
fn pkce_cookie_name(state: &str) -> String {
    format!("{PKCE_PREFIX}{state}")
}

/// El `state` vuelve en la URL: solo se acepta el formato que genera `entrar` (16 bytes en base64 URL).
fn valid_state(s: &str) -> bool {
    s.len() == 22 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn has_session(jar: &PrivateCookieJar) -> bool {
    jar.get(SESSION).and_then(|c| parse_session(c.value())).is_some()
}

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

/// Endpoints que Nextcloud anuncia en su documento de descubrimiento OpenID Connect.
#[derive(Deserialize)]
struct Discovery {
    authorization_endpoint: String,
    token_endpoint: String,
    userinfo_endpoint: String,
}

async fn discovery(st: &AppState) -> AppResult<Discovery> {
    let url = format!("{}/.well-known/openid-configuration", st.config.nextcloud_url);
    Ok(st.http.get(url).send().await?.error_for_status()?.json().await?)
}

pub async fn entrar(State(st): State<AppState>, jar: PrivateCookieJar, Query(q): Query<NextQuery>) -> AppResult<Response> {
    let next = safe_next(q.next.as_deref());
    // Con sesión abierta no hace falta pasar por Nextcloud.
    if has_session(&jar) {
        return Ok(Redirect::to(&next).into_response());
    }
    let verifier = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state_token = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 16]>());
    let disc = discovery(&st).await?;

    let mut url = Url::parse(&disc.authorization_endpoint)?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &st.config.nextcloud_client_id)
        .append_pair("redirect_uri", &format!("{}/auth/callback", st.config.base_url))
        .append_pair("scope", "openid profile email")
        .append_pair("state", &state_token)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");

    let cookie = Cookie::build((pkce_cookie_name(&state_token), format!("{verifier}|{next}")))
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
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct UserInfo {
    sub: String,
    name: Option<String>,
    preferred_username: Option<String>,
    email: Option<String>,
}

pub async fn callback(State(st): State<AppState>, jar: PrivateCookieJar, Query(q): Query<CallbackQuery>) -> AppResult<Response> {
    // Si otro inicio en paralelo de este mismo navegador ya abrió la sesión, se entra igual.
    let logged_in = has_session(&jar);
    let Some(code) = q.code else {
        tracing::warn!(error = ?q.error, description = ?q.error_description, "login rechazado por Nextcloud");
        return if logged_in { Ok(Redirect::to("/jarrones").into_response()) } else { Err(bad(MSG_FALLO)) };
    };
    let Some(state) = q.state.filter(|s| valid_state(s)) else {
        tracing::warn!("callback de OIDC sin state válido");
        return Err(bad(MSG_FALLO));
    };
    // Solo este navegador tiene la cookie cifrada de ese state: es la protección CSRF del flujo.
    let cookie_name = pkce_cookie_name(&state);
    let Some((verifier, next)) = jar.get(&cookie_name).and_then(|c| c.value().split_once('|').map(|(v, n)| (v.to_string(), n.to_string()))) else {
        if logged_in {
            return Ok(Redirect::to("/jarrones").into_response());
        }
        tracing::warn!("callback de OIDC sin cookie para su state (venció o ya se usó)");
        return Err(bad("El inicio de sesión expiró. Vuelve a intentarlo."));
    };

    let disc = discovery(&st).await?;
    let body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "authorization_code")
        .append_pair("code", &code)
        .append_pair("redirect_uri", &format!("{}/auth/callback", st.config.base_url))
        .append_pair("code_verifier", &verifier)
        .finish();
    let response = st
        .http
        .post(&disc.token_endpoint)
        .basic_auth(&st.config.nextcloud_client_id, Some(&st.config.nextcloud_client_secret))
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await?;
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "Nextcloud rechazó el intercambio del código");
        return Err(bad(MSG_FALLO));
    }
    let token: TokenResponse = response.json().await?;
    let info: UserInfo = st
        .http
        .get(&disc.userinfo_endpoint)
        .bearer_auth(&token.access_token)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if info.sub.is_empty() {
        return Err(bad(MSG_FALLO));
    }

    let email_name = info.email.as_deref().and_then(|e| e.split('@').next()).map(str::to_string);
    let name: String = info
        .name
        .or(info.preferred_username)
        .or(email_name)
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "Sin nombre".to_string())
        .chars()
        .take(80)
        .collect();

    let id = perfil_id(&info.sub);
    db::upsert_profile(&st.pool, id, &name, None).await?;
    let jar = jar
        .remove(Cookie::build(cookie_name).path("/auth"))
        .add(session_cookie(id, &name, st.config.base_url.starts_with("https://")));
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

    #[test]
    fn state_solo_acepta_el_formato_propio() {
        let s = URL_SAFE_NO_PAD.encode(rand::random::<[u8; 16]>());
        assert!(valid_state(&s));
        assert!(!valid_state(""));
        assert!(!valid_state("corto"));
        assert!(!valid_state("aaaaaaaaaaaaaaaaaaaa;b"));
        assert!(!valid_state(&"a".repeat(23)));
    }

    #[test]
    fn perfil_id_es_estable_por_usuario() {
        assert_eq!(perfil_id("42"), perfil_id("42"));
        assert_ne!(perfil_id("42"), perfil_id("43"));
    }
}

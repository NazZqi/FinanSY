//! Tests de autorización contra Postgres real. Necesitan DATABASE_URL de un Postgres
//! donde se puedan crear bases de datos: corren en CI con `cargo test -- --include-ignored`.

use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::Path;
use axum::http::{Request, StatusCode, header};
use axum::routing::get;
use axum_extra::extract::cookie::{Key, PrivateCookieJar};
use finansy::{AppState, Config, auth, db};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

const BASE: &str = "http://localhost:3000";

fn state(pool: PgPool) -> AppState {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let config = Config {
        base_url: BASE.into(),
        nextcloud_url: "http://nextcloud.invalid".into(),
        nextcloud_client_id: "test".into(),
        nextcloud_client_secret: "test".into(),
        static_dir: "static".into(),
    };
    AppState { pool, config: Arc::new(config), key: Key::generate(), http: reqwest::Client::new() }
}

/// Crea el perfil y devuelve la cabecera Cookie de una sesión válida, firmada con la llave del estado.
async fn login(st: &AppState, name: &str) -> (Uuid, String) {
    let id = Uuid::new_v4();
    db::upsert_profile(&st.pool, id, name, None).await.unwrap();
    let helper = Router::new()
        .route(
            "/login/{id}/{name}",
            get(|jar: PrivateCookieJar, Path((id, name)): Path<(Uuid, String)>| async move {
                jar.add(auth::session_cookie(id, &name, false))
            }),
        )
        .with_state(st.clone());
    let res = helper.oneshot(Request::get(format!("/login/{id}/{name}")).body(Body::empty()).unwrap()).await.unwrap();
    let set_cookie = res.headers()[header::SET_COOKIE].to_str().unwrap();
    (id, set_cookie.split(';').next().unwrap().to_string())
}

async fn get_as(st: &AppState, cookie: &str, uri: &str) -> StatusCode {
    let req = Request::get(uri).header(header::COOKIE, cookie).body(Body::empty()).unwrap();
    finansy::app(st.clone()).oneshot(req).await.unwrap().status()
}

async fn post_as(st: &AppState, cookie: &str, uri: &str, body: &str, origin: &str) -> StatusCode {
    let req = Request::post(uri)
        .header(header::COOKIE, cookie)
        .header(header::ORIGIN, origin)
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from(body.to_string()))
        .unwrap();
    finansy::app(st.clone()).oneshot(req).await.unwrap().status()
}

async fn group_jar(st: &AppState, owner: Uuid) -> Uuid {
    let new = db::NewJar { kind: "grupal", name: "Viaje", category: "viaje", goal: 1_000_000, target_date: None, rate_bp: 0 };
    db::create_jar(&st.pool, owner, &new).await.unwrap()
}

async fn invite_code(st: &AppState, jar: Uuid) -> String {
    sqlx::query_scalar("select invite_code from finansy.jars where id = $1").bind(jar).fetch_one(&st.pool).await.unwrap()
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn quien_no_es_miembro_recibe_404(pool: PgPool) {
    let st = state(pool);
    let (ana, _) = login(&st, "Ana").await;
    let (_, beto_cookie) = login(&st, "Beto").await;
    let jar = group_jar(&st, ana).await;

    assert_eq!(get_as(&st, &beto_cookie, &format!("/jarrones/{jar}")).await, StatusCode::NOT_FOUND);
    assert_eq!(get_as(&st, &beto_cookie, &format!("/jarrones/{jar}/panel")).await, StatusCode::NOT_FOUND);
    let today = finansy::today();
    let status = post_as(&st, &beto_cookie, &format!("/jarrones/{jar}/aportes"), &format!("amount=1000&date={today}"), BASE).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn ex_miembro_recibe_404(pool: PgPool) {
    let st = state(pool);
    let (ana, ana_cookie) = login(&st, "Ana").await;
    let (beto, beto_cookie) = login(&st, "Beto").await;
    let jar = group_jar(&st, ana).await;
    let code = invite_code(&st, jar).await;

    assert_eq!(get_as(&st, &beto_cookie, &format!("/unirse/{code}")).await, StatusCode::SEE_OTHER);
    assert_eq!(get_as(&st, &beto_cookie, &format!("/jarrones/{jar}")).await, StatusCode::OK);

    let status = post_as(&st, &ana_cookie, &format!("/jarrones/{jar}/miembros/{beto}/sacar"), "", BASE).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    assert_eq!(get_as(&st, &beto_cookie, &format!("/jarrones/{jar}")).await, StatusCode::NOT_FOUND);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn quien_fue_sacado_no_vuelve_con_el_enlace_viejo(pool: PgPool) {
    let st = state(pool);
    let (ana, ana_cookie) = login(&st, "Ana").await;
    let (beto, beto_cookie) = login(&st, "Beto").await;
    let jar = group_jar(&st, ana).await;
    let code = invite_code(&st, jar).await;
    get_as(&st, &beto_cookie, &format!("/unirse/{code}")).await;
    post_as(&st, &ana_cookie, &format!("/jarrones/{jar}/miembros/{beto}/sacar"), "", BASE).await;

    assert_eq!(get_as(&st, &beto_cookie, &format!("/unirse/{code}")).await, StatusCode::NOT_FOUND);
    assert_eq!(get_as(&st, &beto_cookie, &format!("/jarrones/{jar}")).await, StatusCode::NOT_FOUND);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn borrar_un_jarron_grupal_avisa_a_los_miembros(pool: PgPool) {
    let st = state(pool);
    let (ana, ana_cookie) = login(&st, "Ana").await;
    let (beto, beto_cookie) = login(&st, "Beto").await;
    let jar = group_jar(&st, ana).await;
    let code = invite_code(&st, jar).await;
    get_as(&st, &beto_cookie, &format!("/unirse/{code}")).await;

    let status = post_as(&st, &ana_cookie, &format!("/jarrones/{jar}/borrar"), "", BASE).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    assert_eq!(db::unread_count(&st.pool, beto).await.unwrap(), 1);
    // Quien borra no recibe aviso, y los avisos ligados al jarrón se van con él.
    assert_eq!(db::unread_count(&st.pool, ana).await.unwrap(), 0);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn nadie_borra_el_aporte_de_otro(pool: PgPool) {
    let st = state(pool);
    let (ana, ana_cookie) = login(&st, "Ana").await;
    let (_, beto_cookie) = login(&st, "Beto").await;
    let jar = group_jar(&st, ana).await;
    let code = invite_code(&st, jar).await;
    get_as(&st, &beto_cookie, &format!("/unirse/{code}")).await;

    let today = finansy::today();
    let status = post_as(&st, &ana_cookie, &format!("/jarrones/{jar}/aportes"), &format!("amount=20.000&date={today}"), BASE).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    let cid: Uuid = sqlx::query_scalar("select id from finansy.contributions where jar_id = $1").bind(jar).fetch_one(&st.pool).await.unwrap();

    let status = post_as(&st, &beto_cookie, &format!("/jarrones/{jar}/aportes/{cid}/borrar"), "", BASE).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let left: i64 = sqlx::query_scalar("select count(*) from finansy.contributions where id = $1").bind(cid).fetch_one(&st.pool).await.unwrap();
    assert_eq!(left, 1);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn un_aporte_avisa_a_los_demas(pool: PgPool) {
    let st = state(pool);
    let (ana, ana_cookie) = login(&st, "Ana").await;
    let (beto, beto_cookie) = login(&st, "Beto").await;
    let jar = group_jar(&st, ana).await;
    let code = invite_code(&st, jar).await;
    get_as(&st, &beto_cookie, &format!("/unirse/{code}")).await;
    // Unirse avisa a Ana; se descuenta para mirar solo el aviso del aporte.
    db::mark_read(&st.pool, ana).await.unwrap();

    let today = finansy::today();
    post_as(&st, &ana_cookie, &format!("/jarrones/{jar}/aportes"), &format!("amount=15000&date={today}"), BASE).await;
    assert_eq!(db::unread_count(&st.pool, beto).await.unwrap(), 1);
    assert_eq!(db::unread_count(&st.pool, ana).await.unwrap(), 0);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn post_de_otro_origen_es_rechazado(pool: PgPool) {
    let st = state(pool);
    let (ana, ana_cookie) = login(&st, "Ana").await;
    let jar = group_jar(&st, ana).await;
    let today = finansy::today();
    let body = format!("amount=1000&date={today}");

    let status = post_as(&st, &ana_cookie, &format!("/jarrones/{jar}/aportes"), &body, "https://finansy-qa.cinderlink.cl").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let n: i64 = sqlx::query_scalar("select count(*) from finansy.contributions").fetch_one(&st.pool).await.unwrap();
    assert_eq!(n, 0);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "necesita Postgres: corre en CI"]
async fn sin_sesion_redirige_al_login(pool: PgPool) {
    let st = state(pool);
    let res = finansy::app(st).oneshot(Request::get("/jarrones").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(res.status(), StatusCode::SEE_OTHER);
    assert_eq!(res.headers()[header::LOCATION], "/entrar?next=%2Fjarrones");
}

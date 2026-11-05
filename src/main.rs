use std::sync::Arc;

use anyhow::Context;
use axum_extra::extract::cookie::Key;
use finansy::{AppState, Config};
use sqlx::postgres::PgPoolOptions;

fn env(name: &str) -> anyhow::Result<String> {
    std::env::var(name).with_context(|| format!("falta la variable de entorno {name}"))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();
    // reqwest usa rustls sin proveedor propio: se instala ring, el mismo que usa sqlx.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let key = Key::try_from(hex::decode(env("COOKIE_KEY")?)?.as_slice()).context("COOKIE_KEY debe tener al menos 64 bytes en hex")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&env("DATABASE_URL")?).await.context("no se pudo conectar a Postgres")?;
    sqlx::migrate!().run(&pool).await.context("fallaron las migraciones")?;

    let config = Config {
        base_url: env("BASE_URL")?.trim_end_matches('/').to_string(),
        nextcloud_url: env("NEXTCLOUD_URL")?.trim_end_matches('/').to_string(),
        nextcloud_client_id: env("NEXTCLOUD_CLIENT_ID")?,
        nextcloud_client_secret: env("NEXTCLOUD_CLIENT_SECRET")?,
        static_dir: std::env::var("STATIC_DIR").unwrap_or_else(|_| "static".to_string()),
    };
    let http = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build()?;
    let state = AppState { pool, config: Arc::new(config), key, http };

    let addr = format!("0.0.0.0:{}", std::env::var("PORT").unwrap_or_else(|_| "3000".to_string()));
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("FinanSY escuchando en {addr}");
    axum::serve(listener, finansy::app(state)).await?;
    Ok(())
}

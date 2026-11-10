pub mod auth;
pub mod db;
pub mod error;
pub mod game;
pub mod routes;
pub mod sim;
pub mod views;

use std::sync::Arc;

use axum::extract::FromRef;
use axum_extra::extract::cookie::Key;
use chrono::{NaiveDate, Utc};
use sqlx::PgPool;

pub struct Config {
    /// Origen público sin barra final, por ejemplo `https://finansy.cinderlink.cl`.
    pub base_url: String,
    pub supabase_url: String,
    pub supabase_key: String,
    pub static_dir: String,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub key: Key,
    pub http: reqwest::Client,
}

impl FromRef<AppState> for Key {
    fn from_ref(state: &AppState) -> Key {
        state.key.clone()
    }
}

pub fn app(state: AppState) -> axum::Router {
    routes::router(state)
}

/// Fecha de hoy en Chile: semanas, meses y rachas se cuentan en esta zona.
pub fn today() -> NaiveDate {
    Utc::now().with_timezone(&chrono_tz::America::Santiago).date_naive()
}

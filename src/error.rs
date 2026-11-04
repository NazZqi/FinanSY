use askama::Template;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};

use crate::views::ErrorPage;

#[derive(Debug)]
pub enum AppError {
    /// También para lo que existe pero no te pertenece: no revela qué jarrones hay.
    NotFound,
    BadRequest(String),
    Internal(anyhow::Error),
}

pub type AppResult<T> = Result<T, AppError>;

pub fn bad(message: &str) -> AppError {
    AppError::BadRequest(message.to_string())
}

impl<E: Into<anyhow::Error>> From<E> for AppError {
    fn from(err: E) -> Self {
        AppError::Internal(err.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "No encontramos lo que buscas.".to_string()),
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            AppError::Internal(err) => {
                tracing::error!("{err:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Algo falló de nuestro lado. Intenta de nuevo en un rato.".to_string())
            }
        };
        let page = ErrorPage { title: "Ups".into(), header: None, message };
        match page.render() {
            Ok(html) => (status, Html(html)).into_response(),
            Err(_) => (status, page.message).into_response(),
        }
    }
}

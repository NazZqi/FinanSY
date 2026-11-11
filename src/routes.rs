use askama::Template;
use axum::extract::{DefaultBodyLimit, Multipart, Path, Query, Request, State};
use axum::http::{Method, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::routing::{get, post};
use axum::{Form, Router};
use chrono::{DateTime, Datelike, Duration, Months, NaiveDate, Utc};
use serde::Deserialize;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::auth::{self, CurrentUser, MaybeUser};
use crate::db::{self, Contribution, Jar, Member};
use crate::error::{AppResult, bad};
use crate::game::{self, Standing};
use crate::sim::{self, Frequency, PlanKind, clp, parse_clp, parse_pct};
use crate::views::*;
use crate::{AppState, today};

type Page = AppResult<Html<String>>;

/// Tope del archivo de la foto. Se reduce a 640 px antes de guardarla.
const MAX_UPLOAD: usize = 8 * 1024 * 1024;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/entrar", get(auth::entrar))
        .route("/auth/callback", get(auth::callback))
        .route("/salir", post(auth::salir))
        .route("/jarrones", get(jars).post(create_jar))
        .route("/jarrones/nuevo", get(new_jar))
        .route("/jarrones/{id}", get(jar_page))
        .route("/jarrones/{id}/simular", get(preview))
        .route("/jarrones/{id}/aportar", get(contribute_page))
        .route("/jarrones/{id}/aportes", post(add_contribution))
        .route("/jarrones/{id}/aportes/{cid}/borrar", post(delete_contribution))
        .route("/jarrones/{id}/meta", post(update_goal))
        .route("/jarrones/{id}/prioridad", post(set_priority))
        .route("/jarrones/{id}/interes", post(set_rate))
        .route("/jarrones/{id}/imagen", get(image))
        .route("/jarrones/{id}/imagen/subir", post(upload_image).layer(DefaultBodyLimit::max(MAX_UPLOAD)))
        .route("/jarrones/{id}/imagen/quitar", post(remove_image))
        .route("/jarrones/{id}/retos", post(create_challenge))
        .route("/jarrones/{id}/salir", post(leave))
        .route("/jarrones/{id}/miembros/{uid}/sacar", post(remove_member))
        .route("/jarrones/{id}/invitacion", post(new_invite))
        .route("/jarrones/{id}/borrar", post(delete_jar))
        .route("/unirse/{code}", get(join))
        .route("/simular", get(simulator))
        .route("/simular/plan", get(plan_preview))
        .route("/avisos", get(notifications))
        .route("/privacidad", get(privacy))
        .route("/terminos", get(terms))
        .route("/salud", get(health))
        .nest_service("/static", ServeDir::new(&state.config.static_dir))
        .layer(middleware::from_fn(revalidate_static))
        .layer(middleware::from_fn_with_state(state.clone(), same_origin))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// CSRF: SameSite=Lax no basta porque todos los *.cinderlink.cl cuentan como el mismo sitio.
/// Los archivos de /static no llevan versión en la URL: sin esto el navegador reutiliza un
/// app.css viejo tras cada despliegue. `no-cache` lo obliga a preguntar (responde 304 si no cambió).
async fn revalidate_static(req: Request, next: Next) -> Response {
    let is_static = req.uri().path().starts_with("/static/");
    let mut res = next.run(req).await;
    if is_static {
        res.headers_mut().insert(header::CACHE_CONTROL, header::HeaderValue::from_static("no-cache"));
    }
    res
}

async fn same_origin(State(st): State<AppState>, req: Request, next: Next) -> Response {
    if req.method() == Method::POST {
        let origin = req.headers().get(header::ORIGIN).and_then(|v| v.to_str().ok());
        if origin != Some(st.config.base_url.as_str()) {
            return (StatusCode::FORBIDDEN, "Origen no permitido").into_response();
        }
    }
    next.run(req).await
}

fn render(template: impl Template) -> Page {
    Ok(Html(template.render()?))
}

fn fmt_date(d: NaiveDate) -> String {
    d.format("%d-%m-%Y").to_string()
}

const MONTHS: [&str; 12] = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT: [&str; 12] = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

fn month_year(d: NaiveDate) -> String {
    format!("{} de {}", MONTHS[d.month0() as usize], d.year())
}

/// «5 de noviembre de 2026».
fn long_date(d: NaiveDate) -> String {
    format!("{} de {} de {}", d.day(), MONTHS[d.month0() as usize], d.year())
}

/// «12 ene 2027».
fn short_date(d: NaiveDate) -> String {
    format!("{} {} {}", d.day(), MONTHS_SHORT[d.month0() as usize], d.year())
}

/// «Hoy», «Ayer», «Hace 3 días» o, si pasó más de un mes, la fecha corta.
fn relative_day(d: NaiveDate, today: NaiveDate) -> String {
    match (today - d).num_days() {
        0 => "Hoy".into(),
        1 => "Ayer".into(),
        n @ 2..=30 => format!("Hace {n} días"),
        _ => short_date(d),
    }
}

/// Iniciales del avatar: primera letra de las dos primeras palabras del nombre.
fn initials(name: &str) -> String {
    let s: String = name.split_whitespace().take(2).filter_map(|w| w.chars().next()).flat_map(char::to_uppercase).collect();
    if s.is_empty() { "?".into() } else { s }
}

/// Color de avatar (0 a 3) estable por persona.
fn tone(id: Uuid) -> u8 {
    (id.as_bytes().iter().map(|b| u32::from(*b)).sum::<u32>() % 4) as u8
}

/// Parte de `part` en `whole` con un decimal: etiqueta «27,5%» y ancho CSS «27.5».
fn share_label(part: i64, whole: i64) -> (String, String) {
    if whole <= 0 || part <= 0 {
        return ("0%".into(), "0".into());
    }
    let tenths = (i128::from(part) * 1000 / i128::from(whole)).min(1000) as i64;
    let (int, dec) = (tenths / 10, tenths % 10);
    if dec == 0 { (format!("{int}%"), int.to_string()) } else { (format!("{int},{dec}%"), format!("{int}.{dec}")) }
}

/// Próximo hito del jarrón (25, 50, 75 o 100 %) y cuánto falta para llegar.
fn milestone(total: i64, goal: i64, group: bool) -> String {
    let pct = game::pct(total, goal);
    match [25u32, 50, 75, 100].into_iter().find(|m| *m > pct) {
        Some(m) => {
            let needed = (goal * i64::from(m) + 99) / 100 - total;
            format!("Próximo hito: llegar al {m}%. Faltan {} para lograrlo.", clp(needed.max(1)))
        }
        None if group => "¡Llegaron a la meta! Ahora, a disfrutarla.".into(),
        None => "¡Llegaste a la meta! Ahora, a disfrutarla.".into(),
    }
}

fn category_label(category: &str) -> &'static str {
    match category {
        "viaje" => "Viaje",
        "arriendo" => "Arriendo",
        "celular" => "Celular",
        "auto" => "Auto",
        _ => "Otro",
    }
}

/// "1 mes", "3 semanas", "5 días".
fn streak_label(n: u32, freq: Frequency) -> String {
    format!("{n} {}", freq.unit(n != 1))
}

fn category_emoji(category: &str) -> &'static str {
    match category {
        "viaje" => "✈️",
        "arriendo" => "🏠",
        "celular" => "📱",
        "auto" => "🚗",
        _ => "🫙",
    }
}

/// Dirección de la foto del jarrón; el `v` cambia al subir otra y evita servir la vieja desde la caché.
fn image_url(jar: Uuid, image_at: Option<DateTime<Utc>>) -> String {
    image_at.map(|t| format!("/jarrones/{jar}/imagen?v={}", t.timestamp())).unwrap_or_default()
}

/// "noviembre de 2026" para planes mensuales; fecha completa para semanales y diarios.
fn period_label(date: NaiveDate, freq: Frequency) -> String {
    if freq == Frequency::Monthly { month_year(date) } else { fmt_date(date) }
}

fn kind_label(kind: PlanKind, step_bp: i32, freq: Frequency) -> String {
    let pct = (f64::from(step_bp) / 100.0).to_string().replace('.', ",");
    match kind {
        PlanKind::Constant => "Cuotas iguales".into(),
        PlanKind::Decreasing => format!("Cuotas que bajan {pct} % cada {}", freq.unit(false)),
        PlanKind::Increasing => format!("Cuotas que suben {pct} % cada {}", freq.unit(false)),
        PlanKind::Free => "Plan libre: aportas lo que puedas".into(),
    }
}

/// Frecuencia, tipo de plan y cambio por período de un formulario. Vacío = valor por defecto
/// (mensual, cuotas iguales, 10 % si el plan sube o baja).
fn parse_plan_fields(frequency: &str, kind: &str, step: &str) -> Result<(Frequency, PlanKind, i32), &'static str> {
    let freq = if frequency.is_empty() { Frequency::Monthly } else { Frequency::parse(frequency).ok_or("Elige cada cuánto ahorras.")? };
    let kind = if kind.is_empty() { PlanKind::Constant } else { PlanKind::parse(kind).ok_or("Elige el tipo de plan.")? };
    let step_bp = match kind {
        PlanKind::Decreasing | PlanKind::Increasing => {
            let pct = if step.trim().is_empty() { 10.0 } else { parse_pct(step).ok_or("El cambio por período debe estar entre 0 y 50 %.")? };
            if pct > 50.0 {
                return Err("El cambio por período debe estar entre 0 y 50 %.");
            }
            rate_bp(pct)
        }
        _ => 0,
    };
    Ok((freq, kind, step_bp))
}

struct PlanParams {
    goal: i64,
    saved: i64,
    rate_bp: i32,
    freq: Frequency,
    kind: PlanKind,
    step_bp: i32,
}

struct PlanCalc {
    periods: u32,
    now: i64,
    upcoming: Vec<UpcomingRow>,
}

/// Cuota de este período y las que siguen para llegar a la meta en `target`. `None` si la fecha no es futura.
/// Se recalcula con lo ya ahorrado: si alguien aportó de más o de menos, lo que falta se ajusta solo.
fn calc_plan(today: NaiveDate, target: NaiveDate, p: &PlanParams) -> Option<PlanCalc> {
    let periods = sim::periods_until(today, target, p.freq)?;
    let g = p.kind.growth(p.step_bp);
    let now = sim::first_payment(p.goal, p.saved, periods, sim::period_rate(p.rate_bp, p.freq), g);
    let mut upcoming = Vec::new();
    // Con cuotas iguales o libres no hay nada que listar: todas valen lo mismo.
    if now > 0 && g != 1.0 {
        let row = |k: u32| UpcomingRow { label: period_label(sim::add_periods(today, k, p.freq), p.freq), amount: clp(sim::payment_at(now, g, k)) };
        upcoming.extend((0..periods.min(5)).map(row));
        if periods > 5 {
            upcoming.push(UpcomingRow { label: "…".into(), amount: String::new() });
            upcoming.push(row(periods - 1));
        }
    }
    Some(PlanCalc { periods, now, upcoming })
}

struct PaceInput<'a> {
    items: &'a [(NaiveDate, i64)],
    goal: i64,
    saved: i64,
    /// Cuota del plan para este período; 0 si no hay fecha meta.
    required: i64,
    target: Option<NaiveDate>,
    rate_bp: i32,
    freq: Frequency,
    today: NaiveDate,
}

/// Ritmo real de quien ahorra: promedio por período, fecha en que llegaría y qué pasa si aporta más.
fn build_pace(i: &PaceInput) -> PaceView {
    let unit_one = i.freq.unit(false);
    let none = |message: &str| PaceView {
        has_pace: false,
        message: message.into(),
        avg: String::new(),
        unit_one,
        arrival: String::new(),
        verdict: String::new(),
        options: vec![],
    };
    if i.saved >= i.goal {
        return none("Ya completaste tu parte de la meta.");
    }
    let Some(first) = i.items.iter().map(|(d, _)| *d).min() else {
        return none("Registra tu primer aporte y aquí verás tu ritmo y cuándo llegarías a la meta.");
    };
    let avg = (i.saved / i64::from(sim::periods_between(first, i.today, i.freq))).max(1);
    let r = sim::period_rate(i.rate_bp, i.freq);
    let arrival_of = |payment: i64| match sim::periods_to_goal(i.goal, i.saved, payment, r, i.freq.max_periods()) {
        Some(n) => (Some(n), period_label(sim::add_periods(i.today, n, i.freq), i.freq)),
        None => (None, "más de 50 años".to_string()),
    };
    let (periods, arrival) = arrival_of(avg);
    let unit = |n: u32| i.freq.unit(n != 1);
    let verdict = match (periods, i.target.and_then(|t| sim::periods_until(i.today, t, i.freq))) {
        (Some(n), Some(t)) if n < t => format!("{} {} antes de tu meta", t - n, unit(t - n)),
        (Some(n), Some(t)) if n == t => "justo a tiempo".to_string(),
        (Some(n), Some(t)) => format!("{} {} después de tu meta", n - t, unit(n - t)),
        (None, Some(_)) => "no llegas a tiempo".to_string(),
        _ => String::new(),
    };
    let base = if i.required > 0 { i.required } else { avg };
    let options = [("Cuota de tu plan", 100), ("25 % más", 125), ("50 % más", 150), ("El doble", 200)]
        .into_iter()
        .map(|(label, pct)| {
            let amount = (base * pct + 99) / 100;
            PaceOption { label, amount: clp(amount), arrival: arrival_of(amount).1 }
        })
        .collect();
    PaceView { has_pace: true, message: String::new(), avg: clp(avg), unit_one, arrival, verdict, options }
}

fn clean(input: &str, max: usize) -> Option<String> {
    let t = input.trim();
    (!t.is_empty() && t.chars().count() <= max).then(|| t.to_string())
}

fn parse_date(input: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(input.trim(), "%Y-%m-%d").ok()
}

/// Años hacia adelante que admite la fecha de una meta.
const MAX_GOAL_YEARS: i32 = 50;

/// Última fecha de meta permitida, para el `max` de los campos de fecha.
fn max_goal_date(today: NaiveDate) -> String {
    format!("{}-12-31", today.year() + MAX_GOAL_YEARS)
}

/// La fecha de una meta debe ser futura y estar dentro de los próximos 50 años.
fn check_goal_date(date: NaiveDate, today: NaiveDate) -> Result<(), &'static str> {
    if date <= today {
        return Err("La fecha de la meta debe ser futura.");
    }
    if date.year() > today.year() + MAX_GOAL_YEARS {
        return Err("La fecha de la meta puede ser como máximo en 50 años.");
    }
    Ok(())
}

fn parse_optional_future_date(input: &str) -> AppResult<Option<NaiveDate>> {
    if input.trim().is_empty() {
        return Ok(None);
    }
    let date = parse_date(input).ok_or_else(|| bad("La fecha no es válida."))?;
    check_goal_date(date, today()).map_err(bad)?;
    Ok(Some(date))
}

fn rate_bp(pct: f64) -> i32 {
    (pct * 100.0).round() as i32
}

async fn header(st: &AppState, user: &CurrentUser) -> AppResult<Option<Header>> {
    let (unread, dates) = tokio::try_join!(db::unread_count(&st.pool, user.id), db::my_contribution_dates(&st.pool, user.id))?;
    Ok(Some(Header { name: user.name.clone(), initials: initials(&user.name), unread, streak: game::streak(&dates, today(), Frequency::Monthly) }))
}

async fn index(MaybeUser(user): MaybeUser) -> AppResult<Response> {
    if user.is_some() {
        return Ok(Redirect::to("/jarrones").into_response());
    }
    Ok(render(IndexPage { title: "Ahorremos juntos".into(), header: None })?.into_response())
}

async fn privacy(State(st): State<AppState>, MaybeUser(user): MaybeUser) -> Page {
    let header = match &user {
        Some(u) => header(&st, u).await?,
        None => None,
    };
    render(PrivacyPage { title: "Privacidad".into(), header })
}

async fn terms(State(st): State<AppState>, MaybeUser(user): MaybeUser) -> Page {
    let header = match &user {
        Some(u) => header(&st, u).await?,
        None => None,
    };
    render(TermsPage { title: "Términos y condiciones".into(), header })
}

async fn health(State(st): State<AppState>) -> AppResult<&'static str> {
    sqlx::query("select 1").execute(&st.pool).await?;
    Ok("ok")
}

async fn jars(State(st): State<AppState>, user: CurrentUser) -> Page {
    let today = today();
    let jars = db::list_jars(&st.pool, user.id)
        .await?
        .into_iter()
        .map(|j| {
            let freq = Frequency::parse(&j.frequency).unwrap_or(Frequency::Monthly);
            JarCard {
                reminder: j.total < j.goal_amount && !j.my_last_on.is_some_and(|d| game::contributed_this_period(&[d], today, freq)),
                reminder_period: freq.this_period(),
                pct: game::pct(j.total, j.goal_amount),
                total: clp(j.total),
                goal: clp(j.goal_amount),
                kind: if j.kind == "grupal" { "Grupal" } else { "Individual" },
                category: category_label(&j.category),
                members: j.members,
                priority: j.priority.unwrap_or(0),
                image: image_url(j.id, j.image_at),
                emoji: category_emoji(&j.category),
                owner: j.is_owner,
                id: j.id,
                name: j.name,
            }
        })
        .collect();
    render(JarsPage { title: "Mis jarrones".into(), header: header(&st, &user).await?, jars })
}

async fn new_jar(State(st): State<AppState>, user: CurrentUser) -> Page {
    let today = today();
    render(NewJarPage {
        title: "Nuevo jarrón".into(),
        header: header(&st, &user).await?,
        today_long: long_date(today),
        tomorrow: (today + Duration::days(1)).format("%Y-%m-%d").to_string(),
        max_date: max_goal_date(today),
        me_name: user.name.split_whitespace().next().unwrap_or("Tú").to_string(),
        me_initials: initials(&user.name),
    })
}

#[derive(Deserialize)]
struct NewJarForm {
    kind: String,
    name: String,
    category: String,
    goal: String,
    #[serde(default)]
    target_date: String,
    #[serde(default)]
    rate: String,
    #[serde(default)]
    frequency: String,
    #[serde(default)]
    plan_kind: String,
    #[serde(default)]
    step: String,
    #[serde(default)]
    first: String,
}

async fn create_jar(State(st): State<AppState>, user: CurrentUser, Form(f): Form<NewJarForm>) -> AppResult<Redirect> {
    let kind = match f.kind.as_str() {
        "individual" | "grupal" => f.kind.as_str(),
        _ => return Err(bad("Elige si el jarrón es individual o grupal.")),
    };
    let category = match f.category.as_str() {
        "viaje" | "arriendo" | "celular" | "auto" | "otro" => f.category.as_str(),
        _ => return Err(bad("Elige una categoría.")),
    };
    let name = clean(&f.name, 60).ok_or_else(|| bad("El nombre debe tener entre 1 y 60 caracteres."))?;
    let goal = parse_clp(&f.goal).ok_or_else(|| bad("La meta debe ser un monto mayor que cero."))?;
    let target_date = parse_optional_future_date(&f.target_date)?;
    let rate = parse_pct(&f.rate).ok_or_else(|| bad("La tasa de ahorro debe estar entre 0 y 100 %."))?;
    let (freq, plan, step_bp) = parse_plan_fields(&f.frequency, &f.plan_kind, &f.step).map_err(bad)?;
    // Opcional: vacío o 0 es "sin primer aporte".
    let first_amount = match sim::parse_clp_or_zero(&f.first) {
        Some(0) => None,
        Some(amount) => Some(amount),
        None => return Err(bad("Revisa el primer aporte: escribe un monto en pesos o déjalo vacío.")),
    };
    let new = db::NewJar {
        kind,
        name: &name,
        category,
        goal,
        target_date,
        rate_bp: rate_bp(rate),
        frequency: freq.as_str(),
        plan_kind: plan.as_str(),
        step_bp,
        first_amount,
        today: today(),
    };
    let id = db::create_jar(&st.pool, user.id, &new).await?;
    Ok(Redirect::to(&format!("/jarrones/{id}")))
}

struct Loaded {
    jar: Jar,
    members: Vec<Member>,
    contribs: Vec<Contribution>,
}

impl Loaded {
    fn total(&self) -> i64 {
        self.contribs.iter().map(|c| c.amount).sum()
    }

    fn active_count(&self) -> usize {
        self.members.iter().filter(|m| m.left_at.is_none()).count()
    }

    fn user_items(&self, user: Uuid) -> Vec<(NaiveDate, i64)> {
        self.contribs.iter().filter(|c| c.user_id == user).map(|c| (c.contributed_on, c.amount)).collect()
    }

    /// Cada miembro activo: quién es, cuánto lleva y el interés de su cuenta.
    fn parts(&self) -> Vec<(Uuid, i64, i32)> {
        self.members
            .iter()
            .filter(|m| m.left_at.is_none())
            .map(|m| (m.user_id, self.user_items(m.user_id).iter().map(|(_, a)| a).sum(), m.savings_rate_bp))
            .collect()
    }
}

async fn load(st: &AppState, jar_id: Uuid, user: Uuid) -> AppResult<Loaded> {
    let jar = db::require_member(&st.pool, jar_id, user).await?;
    let (members, contribs) = tokio::try_join!(db::members(&st.pool, jar.id), db::contributions(&st.pool, jar.id))?;
    Ok(Loaded { jar, members, contribs })
}

fn build_panel(l: &Loaded, today: NaiveDate, me: Uuid) -> Panel {
    let goal = l.jar.goal_amount;
    let total = l.total();
    let share = game::share_per_member(goal, l.active_count());

    let member_row = |m: &Member, active: bool, position: usize| {
        let items = l.user_items(m.user_id);
        let member_total: i64 = items.iter().map(|(_, a)| a).sum();
        let today_total: i64 = items.iter().filter(|(d, _)| *d == today).map(|(_, a)| a).sum();
        let (last, last_today) = match items.iter().map(|(d, _)| *d).max() {
            Some(d) if d == today => (format!("+ {} hoy", clp(today_total)), true),
            Some(d) => (relative_day(d, today), false),
            None => ("Sin registros".to_string(), false),
        };
        let (part_label, part_width) = share_label(member_total, total);
        MemberRow {
            name: m.name.clone(),
            initials: initials(&m.name),
            tone: tone(m.user_id),
            mine: m.user_id == me,
            total: clp(member_total),
            last,
            last_today,
            part_label,
            part_width,
            active,
            position,
        }
    };

    let mut active: Vec<(Standing, &Member)> = l
        .members
        .iter()
        .filter(|m| m.left_at.is_none())
        .map(|m| (Standing { name: m.name.clone(), total: l.user_items(m.user_id).iter().map(|(_, a)| a).sum(), share }, m))
        .collect();
    game::rank(&mut active, |row| &row.0);

    let mut members: Vec<MemberRow> = active.iter().enumerate().map(|(i, (_, m))| member_row(m, true, i + 1)).collect();
    // Quien salió conserva sus aportes en el total, pero no cuenta para cuota ni ranking.
    for m in l.members.iter().filter(|m| m.left_at.is_some()) {
        members.push(member_row(m, false, 0));
    }

    Panel {
        jar_id: l.jar.id,
        group: l.jar.is_group(),
        total: clp(total),
        goal: clp(goal),
        missing: clp((goal - total).max(0)),
        pct: game::pct(total, goal),
        share: clp(share),
        members,
    }
}

#[derive(Deserialize)]
struct JarQuery {
    /// Monto recién registrado: muestra el aviso «¡Ahorro registrado!».
    #[serde(default)]
    registrado: String,
}

fn contrib_row(c: &Contribution, me: Uuid, today: NaiveDate) -> ContribRow {
    ContribRow {
        id: c.id,
        name: c.name.clone(),
        initials: initials(&c.name),
        tone: tone(c.user_id),
        amount: clp(c.amount),
        date: fmt_date(c.contributed_on),
        when: relative_day(c.contributed_on, today),
        note: c.note.clone().unwrap_or_default(),
        mine: c.user_id == me,
    }
}

async fn jar_page(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Query(q): Query<JarQuery>) -> Page {
    let l = load(&st, id, user.id).await?;
    let today = today();
    let jar = &l.jar;
    let goal = jar.goal_amount;
    let total = l.total();
    let mine = l.user_items(user.id);
    let my_total: i64 = mine.iter().map(|(_, a)| a).sum();
    let my_dates: Vec<NaiveDate> = mine.iter().map(|(d, _)| *d).collect();
    let share = game::share_per_member(goal, l.active_count());

    let freq = jar.freq();
    let kind = jar.plan();
    let my_rate = l.members.iter().find(|m| m.user_id == user.id).map_or(0, |m| m.savings_rate_bp);
    // Cada persona ahorra en su banco con su propio interés: el plan de cada una usa su tasa.
    let plan_for = |saved: i64, rate_bp: i32| {
        jar.target_date.and_then(|t| calc_plan(today, t, &PlanParams { goal: share, saved, rate_bp, freq, kind, step_bp: jar.plan_step_bp }))
    };
    // Lo del jarrón es la suma de lo que necesita cada miembro activo.
    let group_now: i64 = l.parts().iter().filter_map(|(_, saved, rate)| plan_for(*saved, *rate)).map(|c| c.now).sum();
    let my_calc = plan_for(my_total, my_rate);
    let date_passed = jar.target_date.is_some() && my_calc.is_none();
    let (my_now, periods_left, upcoming) = my_calc.map_or((0, 0, vec![]), |c| (c.now, c.periods, c.upcoming));
    let plan = PlanView {
        has_date: jar.target_date.is_some(),
        date_passed,
        target: jar.target_date.map(fmt_date).unwrap_or_default(),
        periods_left,
        unit: freq.unit(true),
        unit_one: freq.unit(false),
        this_period: freq.this_period(),
        kind_label: kind_label(kind, jar.plan_step_bp, freq),
        free: kind == PlanKind::Free,
        group_now: clp(group_now),
        my_now: clp(my_now),
        upcoming,
    };
    let pace = build_pace(&PaceInput {
        items: &mine,
        goal: share,
        saved: my_total,
        required: my_now,
        target: jar.target_date,
        rate_bp: my_rate,
        freq,
        today,
    });

    let items: Vec<(NaiveDate, i64)> = l.contribs.iter().map(|c| (c.contributed_on, c.amount)).collect();
    let start = items.iter().map(|(d, _)| *d).min().unwrap_or(today);
    let end = jar.target_date.unwrap_or(today).max(today).max(start);
    let max_y = goal.max(total);
    let chart = Chart {
        has_data: !items.is_empty(),
        points: game::cumulative_points(&items, start, end, max_y, 600.0, 200.0),
        goal_y: format!("{:.1}", 200.0 - goal as f64 / max_y as f64 * 200.0),
        from: fmt_date(start),
        to: fmt_date(end),
    };

    let challenges = db::challenges(&st.pool, jar.id)
        .await?
        .into_iter()
        .map(|ch| ChallengeRow {
            members: l
                .members
                .iter()
                .filter(|m| m.left_at.is_none())
                .map(|m| {
                    let done = game::sum_in_range(&l.user_items(m.user_id), ch.starts_on, ch.ends_on);
                    ChallengeMember { name: m.name.clone(), pct: game::pct(done, ch.amount_per_member), done: done >= ch.amount_per_member }
                })
                .collect(),
            title: ch.title,
            amount: clp(ch.amount_per_member),
            range: format!("{} al {}", fmt_date(ch.starts_on), fmt_date(ch.ends_on)),
            open: today <= ch.ends_on,
        })
        .collect();

    let contributions = l.contribs.iter().map(|c| contrib_row(c, user.id, today)).collect();
    let recent = l.contribs.iter().take(3).map(|c| contrib_row(c, user.id, today)).collect();
    let others = l
        .members
        .iter()
        .filter(|m| m.left_at.is_none() && m.user_id != user.id)
        .map(|m| OtherMember { id: m.user_id, name: m.name.clone() })
        .collect();

    render(JarPage {
        title: jar.name.clone(),
        header: header(&st, &user).await?,
        jar_id: jar.id,
        name: jar.name.clone(),
        category: category_label(&jar.category),
        group: jar.is_group(),
        owner: jar.owner_id == user.id,
        invite_url: jar.invite_code.as_ref().map(|c| format!("{}/unirse/{c}", st.config.base_url)).unwrap_or_default(),
        reminder: total < goal && !game::contributed_this_period(&my_dates, today, freq),
        reminder_period: freq.this_period(),
        people: l.active_count(),
        cover: jar.category == "viaje",
        today_long: long_date(today),
        banner: parse_clp(&q.registrado).map(clp),
        banner_time: Utc::now().with_timezone(&chrono_tz::America::Santiago).format("%H:%M").to_string(),
        total: clp(total),
        goal: clp(goal),
        missing: clp((goal - total).max(0)),
        pct: game::pct(total, goal),
        // Los aportes vienen del más reciente al más antiguo.
        last_mine: l.contribs.iter().find(|c| c.user_id == user.id).map(|c| clp(c.amount)),
        days_left: jar.target_date.map(|t| (t - today).num_days()).filter(|d| *d > 0),
        target_long: jar.target_date.map(long_date).unwrap_or_default(),
        streak: game::streak(&my_dates, today, freq),
        streak_label: streak_label(game::streak(&my_dates, today, freq), freq),
        milestone: milestone(total, goal, jar.is_group()),
        recent,
        panel: build_panel(&l, today, user.id),
        plan,
        pace,
        image: image_url(jar.id, jar.image_at),
        emoji: category_emoji(&jar.category),
        frequency_input: freq.as_str(),
        kind_input: kind.as_str(),
        step_input: (jar.plan_step_bp / 100).to_string(),
        rate_input: (f64::from(my_rate) / 100.0).to_string().replace('.', ","),
        chart,
        contributions,
        challenges,
        others,
        today: today.format("%Y-%m-%d").to_string(),
        goal_input: goal.to_string(),
        date_input: jar.target_date.map(|d| d.format("%Y-%m-%d").to_string()).unwrap_or_default(),
        max_date: max_goal_date(today),
    })
}

/// «Registrar ahorro»: formulario aparte con el contexto del jarrón y cómo quedará.
async fn contribute_page(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> Page {
    let l = load(&st, id, user.id).await?;
    let today = today();
    let jar = &l.jar;
    let total = l.total();
    let mine = l.user_items(user.id);
    let my_total: i64 = mine.iter().map(|(_, a)| a).sum();
    let my_dates: Vec<NaiveDate> = mine.iter().map(|(d, _)| *d).collect();
    render(ContributePage {
        title: format!("Registrar ahorro · {}", jar.name),
        header: header(&st, &user).await?,
        jar: JarContext {
            id: jar.id,
            name: jar.name.clone(),
            group: jar.is_group(),
            people: l.active_count(),
            cover: jar.category == "viaje",
            goal: clp(jar.goal_amount),
            total: clp(total),
            pct: game::pct(total, jar.goal_amount),
            target_short: jar.target_date.map(short_date).unwrap_or_default(),
        },
        goal_raw: jar.goal_amount,
        total_raw: total,
        my_total_raw: my_total,
        my_total: clp(my_total),
        initials: initials(&user.name),
        today: today.format("%Y-%m-%d").to_string(),
        min_date: (today - Duration::days(366)).format("%Y-%m-%d").to_string(),
        today_long: long_date(today),
        streak: game::streak(&my_dates, today, jar.freq()),
        streak_label: streak_label(game::streak(&my_dates, today, jar.freq()), jar.freq()),
        this_period: jar.freq().this_period(),
    })
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct PreviewQuery {
    goal: String,
    target_date: String,
    frequency: String,
    plan_kind: String,
    step: String,
    /// Solo al crear: interés anual y primer aporte.
    rate: String,
    first: String,
}

/// Cuota de este período y las siguientes para una meta y una fecha, sin guardar nada.
/// `parts` trae lo ahorrado y el interés de cada miembro; `mine` es la posición de quien mira.
/// La meta se reparte en partes iguales y cada parte usa el interés de su dueño.
fn preview_fragment(q: &PreviewQuery, parts: &[(i64, i32)], mine: usize) -> PreviewFragment {
    let fail = |message: &str| PreviewFragment {
        ok: false,
        message: message.into(),
        periods: 0,
        unit: "meses",
        unit_one: "mes",
        this_period: "este mes",
        free: false,
        now: String::new(),
        per_member: String::new(),
        upcoming: vec![],
    };
    let (Some(goal), Some(date)) = (parse_clp(&q.goal), parse_date(&q.target_date)) else {
        return fail("Escribe una meta y una fecha para ver cuánto aportar.");
    };
    let (freq, kind, step_bp) = match parse_plan_fields(&q.frequency, &q.plan_kind, &q.step) {
        Ok(fields) => fields,
        Err(message) => return fail(message),
    };
    if let Err(message) = check_goal_date(date, today()) {
        return fail(message);
    }
    let share = game::share_per_member(goal, parts.len());
    let calcs: Vec<PlanCalc> = parts
        .iter()
        .filter_map(|(saved, rate_bp)| calc_plan(today(), date, &PlanParams { goal: share, saved: *saved, rate_bp: *rate_bp, freq, kind, step_bp }))
        .collect();
    let group_now: i64 = calcs.iter().map(|c| c.now).sum();
    let Some(my_calc) = calcs.into_iter().nth(mine) else {
        return fail("La fecha debe ser futura.");
    };
    let per_member = if parts.len() > 1 { clp(my_calc.now) } else { String::new() };
    PreviewFragment {
        ok: true,
        message: String::new(),
        periods: my_calc.periods,
        unit: freq.unit(true),
        unit_one: freq.unit(false),
        this_period: freq.this_period(),
        free: kind == PlanKind::Free,
        now: clp(group_now),
        per_member,
        upcoming: my_calc.upcoming,
    }
}

/// Simular juntos: la cuota con otra meta, fecha o plan, sin guardar nada.
async fn preview(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Query(q): Query<PreviewQuery>) -> Page {
    let l = load(&st, id, user.id).await?;
    let parts = l.parts();
    let mine = parts.iter().position(|(uid, _, _)| *uid == user.id).unwrap_or(0);
    let parts: Vec<(i64, i32)> = parts.iter().map(|(_, saved, rate)| (*saved, *rate)).collect();
    render(preview_fragment(&q, &parts, mine))
}

/// Vista previa al crear un jarrón: se ajusta con el primer aporte que se escriba.
async fn plan_preview(Query(q): Query<PreviewQuery>) -> Page {
    let rate = parse_pct(&q.rate).map_or(0, rate_bp);
    let saved = parse_clp(&q.first).unwrap_or(0);
    render(preview_fragment(&q, &[(saved, rate)], 0))
}

#[derive(Deserialize)]
struct RateForm {
    #[serde(default)]
    rate: String,
}

/// Interés de la cuenta de ahorro propia: cada miembro cambia solo el suyo.
async fn set_rate(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Form(f): Form<RateForm>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    let rate = parse_pct(&f.rate).ok_or_else(|| bad("El interés debe estar entre 0 y 100 %."))?;
    db::set_member_rate(&st.pool, jar.id, user.id, rate_bp(rate)).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

#[derive(Deserialize)]
struct ContribForm {
    amount: String,
    date: String,
    #[serde(default)]
    note: String,
}

async fn add_contribution(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Form(f): Form<ContribForm>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    let amount = parse_clp(&f.amount).ok_or_else(|| bad("El aporte debe ser un monto mayor que cero."))?;
    let date = parse_date(&f.date).ok_or_else(|| bad("La fecha del aporte no es válida."))?;
    let today = today();
    if date > today || date < today - Duration::days(366) {
        return Err(bad("La fecha del aporte debe ser del último año y no puede ser futura."));
    }
    let note = f.note.trim();
    if note.chars().count() > 140 {
        return Err(bad("La nota puede tener hasta 140 caracteres."));
    }
    let notice = format!("{} aportó {} a «{}»", user.name, clp(amount), jar.name);
    db::add_contribution(&st.pool, jar.id, user.id, amount, date, (!note.is_empty()).then_some(note), &notice).await?;
    Ok(Redirect::to(&format!("/jarrones/{}?registrado={amount}", jar.id)))
}

async fn delete_contribution(State(st): State<AppState>, user: CurrentUser, Path((id, cid)): Path<(Uuid, Uuid)>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    db::delete_contribution(&st.pool, jar.id, user.id, cid).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

#[derive(Deserialize)]
struct GoalForm {
    goal: String,
    #[serde(default)]
    target_date: String,
    #[serde(default)]
    frequency: String,
    #[serde(default)]
    plan_kind: String,
    #[serde(default)]
    step: String,
}

/// Solo quien creó el jarrón cambia la meta y el plan; los demás solo pueden simular.
async fn update_goal(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Form(f): Form<GoalForm>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    if jar.owner_id != user.id {
        return Err(crate::error::AppError::NotFound);
    }
    let goal = parse_clp(&f.goal).ok_or_else(|| bad("La meta debe ser un monto mayor que cero."))?;
    let target = parse_optional_future_date(&f.target_date)?;
    let (freq, kind, step_bp) = parse_plan_fields(&f.frequency, &f.plan_kind, &f.step).map_err(bad)?;
    let when = target.map(|d| format!(" para el {}", fmt_date(d))).unwrap_or_default();
    let notice = format!("{} cambió la meta de «{}» a {}{when}", user.name, jar.name, clp(goal));
    let change = db::PlanChange { goal, target_date: target, frequency: freq.as_str(), plan_kind: kind.as_str(), step_bp };
    db::update_plan(&st.pool, &jar, user.id, &change, &notice).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

#[derive(Deserialize)]
struct PriorityForm {
    #[serde(default)]
    priority: String,
}

/// Prioridad personal en «Mis jarrones»: cada miembro ordena los suyos.
async fn set_priority(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Form(f): Form<PriorityForm>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    let priority = match f.priority.trim() {
        "" => None,
        p => Some(p.parse::<i16>().ok().filter(|n| (1..=99).contains(n)).ok_or_else(|| bad("La prioridad debe ser un número entre 1 y 99."))?),
    };
    db::set_priority(&st.pool, jar.id, user.id, priority).await?;
    Ok(Redirect::to("/jarrones"))
}

/// Decodifica la foto con límites, la gira según el EXIF, la reduce a 640 px y la guarda como JPEG.
/// Recodificar quita EXIF y GPS, y descarta lo que no sea una imagen real.
fn shrink_image(data: &[u8]) -> Option<Vec<u8>> {
    use image::{DynamicImage, ImageDecoder, ImageReader, Limits};
    let mut decoder = ImageReader::new(std::io::Cursor::new(data)).with_guessed_format().ok()?.into_decoder().ok()?;
    // 8192 px admite fotos de celular de 50 MP; 192 MB alcanza para decodificarlas en RGB.
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(192 * 1024 * 1024);
    decoder.set_limits(limits).ok()?;
    let orientation = decoder.orientation().ok();
    let mut img = DynamicImage::from_decoder(decoder).ok()?;
    if let Some(orientation) = orientation {
        img.apply_orientation(orientation);
    }
    let rgb = img.thumbnail(640, 640).to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 82).encode_image(&rgb).ok()?;
    (out.len() <= 1_048_576).then_some(out)
}

async fn upload_image(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, mut form: Multipart) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    if jar.owner_id != user.id {
        return Err(crate::error::AppError::NotFound);
    }
    let too_big = || bad("No se pudo leer la foto. Elige una de hasta 8 MB.");
    let mut photo = None;
    while let Some(field) = form.next_field().await.map_err(|_| too_big())? {
        if field.name() == Some("photo") {
            photo = Some(field.bytes().await.map_err(|_| too_big())?);
        }
    }
    let photo = photo.filter(|b| !b.is_empty()).ok_or_else(|| bad("Elige una foto para subir."))?;
    // Una foto a la vez en todo el servidor: varias subidas juntas no agotan la memoria.
    static DECODES: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(1);
    let _turn = DECODES.acquire().await?;
    let jpeg = tokio::task::spawn_blocking(move || shrink_image(&photo)).await?.ok_or_else(|| bad("Ese archivo no es una foto válida. Usa JPG, PNG o WebP."))?;
    db::set_image(&st.pool, &jar, user.id, &jpeg).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

async fn remove_image(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    db::clear_image(&st.pool, &jar, user.id).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

async fn image(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> AppResult<Response> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    let data = db::get_image(&st.pool, jar.id).await?;
    let headers = [
        (header::CONTENT_TYPE, "image/jpeg"),
        (header::CACHE_CONTROL, "private, max-age=31536000, immutable"),
        (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
    ];
    Ok((headers, data).into_response())
}

#[derive(Deserialize)]
struct ChallengeForm {
    title: String,
    amount: String,
    starts_on: String,
    ends_on: String,
}

async fn create_challenge(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Form(f): Form<ChallengeForm>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    if !jar.is_group() {
        return Err(bad("Los retos son para jarrones grupales."));
    }
    let title = clean(&f.title, 60).ok_or_else(|| bad("El reto necesita un nombre de hasta 60 caracteres."))?;
    let amount = parse_clp(&f.amount).ok_or_else(|| bad("El monto del reto debe ser mayor que cero."))?;
    let (Some(starts_on), Some(ends_on)) = (parse_date(&f.starts_on), parse_date(&f.ends_on)) else {
        return Err(bad("Revisa las fechas del reto."));
    };
    if ends_on < starts_on || ends_on - starts_on > Duration::days(366) {
        return Err(bad("El reto debe terminar después de empezar y durar como máximo un año."));
    }
    let notice = format!("{} creó el reto «{title}» en «{}»: {} cada uno", user.name, jar.name, clp(amount));
    db::create_challenge(&st.pool, jar.id, user.id, &title, amount, starts_on, ends_on, &notice).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

async fn leave(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    db::leave(&st.pool, &jar, user.id).await?;
    Ok(Redirect::to("/jarrones"))
}

async fn remove_member(State(st): State<AppState>, user: CurrentUser, Path((id, member)): Path<(Uuid, Uuid)>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    db::remove_member(&st.pool, &jar, user.id, member).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

async fn new_invite(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    db::regenerate_invite(&st.pool, &jar, user.id).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
}

async fn delete_jar(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    let notice = format!("{} borró el jarrón «{}» con todos sus aportes", user.name, jar.name);
    db::delete_jar(&st.pool, &jar, user.id, &notice).await?;
    Ok(Redirect::to("/jarrones"))
}

async fn join(State(st): State<AppState>, user: CurrentUser, Path(code): Path<String>) -> AppResult<Redirect> {
    if code.len() != 10 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(crate::error::AppError::NotFound);
    }
    let jar_id = db::join(&st.pool, &code, user.id, &user.name).await?;
    Ok(Redirect::to(&format!("/jarrones/{jar_id}")))
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct SimQuery {
    modo: String,
    meta: String,
    ahorrado: String,
    fecha: String,
    personas: String,
    tasa: String,
    aporte: String,
    precio: String,
    n: String,
    tasa_cuota: String,
    costos: String,
}

fn optional_clp(input: &str) -> Result<i64, &'static str> {
    sim::parse_clp_or_zero(input).ok_or("Revisa el monto ya ahorrado.")
}

fn simulate_cuota(q: &SimQuery, today: NaiveDate) -> Result<CuotaResult, &'static str> {
    let goal = parse_clp(&q.meta).ok_or("Escribe una meta mayor que cero.")?;
    let saved = optional_clp(&q.ahorrado)?;
    let date = parse_date(&q.fecha).ok_or("Elige la fecha de la meta.")?;
    let months = sim::months_until(today, date).ok_or("La fecha de la meta debe ser futura.")?;
    let people: u32 = match q.personas.trim() {
        "" => 1,
        p => p.parse().ok().filter(|n| (1..=50).contains(n)).ok_or("Las personas deben ser entre 1 y 50.")?,
    };
    let rate = parse_pct(&q.tasa).ok_or("La tasa de ahorro debe estar entre 0 y 100 %.")?;
    let monthly = sim::monthly_payment(goal, saved, months, sim::monthly_rate(rate_bp(rate)));
    let per_person = (monthly + i64::from(people) - 1) / i64::from(people);
    Ok(CuotaResult { monthly: clp(monthly), per_person: clp(per_person), months, people })
}

fn simulate_fecha(q: &SimQuery, today: NaiveDate) -> Result<FechaResult, &'static str> {
    let goal = parse_clp(&q.meta).ok_or("Escribe una meta mayor que cero.")?;
    let saved = optional_clp(&q.ahorrado)?;
    let payment = parse_clp(&q.aporte).ok_or("Escribe cuánto aportas al mes.")?;
    let rate = parse_pct(&q.tasa).ok_or("La tasa de ahorro debe estar entre 0 y 100 %.")?;
    let months = sim::months_to_goal(goal, saved, payment, sim::monthly_rate(rate_bp(rate)))
        .ok_or("Con ese aporte no llegas en 50 años. Prueba con un aporte mayor.")?;
    let date = today.checked_add_months(Months::new(months)).unwrap_or(today);
    Ok(FechaResult { months, date: month_year(date) })
}

fn simulate_cuotas(q: &SimQuery) -> Result<CuotasResult, &'static str> {
    let price = parse_clp(&q.precio).ok_or("Escribe el precio de la compra.")?;
    let n: u32 = q.n.trim().parse().ok().filter(|n| (1..=120).contains(n)).ok_or("Las cuotas deben ser entre 1 y 120.")?;
    let monthly_pct = parse_pct(&q.tasa_cuota).ok_or("La tasa mensual debe estar entre 0 y 100 %.")?;
    let costs = sim::parse_clp_or_zero(&q.costos).ok_or("Revisa los costos fijos.")?;
    let rate = parse_pct(&q.tasa).ok_or("La tasa de ahorro debe estar entre 0 y 100 %.")?;
    let cmp = sim::save_vs_installments(price, n, monthly_pct, costs, rate_bp(rate));
    Ok(CuotasResult {
        cuota: clp(cmp.plan.cuota),
        total: clp(cmp.plan.total),
        sobrecosto: clp(cmp.plan.sobrecosto),
        months_saving: cmp.months_saving.map_or_else(|| "más de 50 años".to_string(), |m| format!("{m} meses")),
    })
}

async fn simulator(State(st): State<AppState>, MaybeUser(user): MaybeUser, Query(q): Query<SimQuery>) -> Page {
    let header = match &user {
        Some(u) => header(&st, u).await?,
        None => None,
    };
    let today = today();
    let mut page = SimPage { title: "Simulador".into(), header, modo: q.modo.clone(), form: SimForm::default(), error: String::new(), cuota: None, fecha: None, cuotas: None };
    let outcome = match q.modo.as_str() {
        "cuota" => simulate_cuota(&q, today).map(|r| page.cuota = Some(r)),
        "fecha" => simulate_fecha(&q, today).map(|r| page.fecha = Some(r)),
        "cuotas" => simulate_cuotas(&q).map(|r| page.cuotas = Some(r)),
        _ => Ok(()),
    };
    if let Err(message) = outcome {
        page.error = message.to_string();
    }
    page.form = SimForm {
        meta: q.meta,
        ahorrado: q.ahorrado,
        fecha: q.fecha,
        personas: q.personas,
        tasa: q.tasa,
        aporte: q.aporte,
        precio: q.precio,
        n: q.n,
        tasa_cuota: q.tasa_cuota,
        costos: q.costos,
    };
    render(page)
}

async fn notifications(State(st): State<AppState>, user: CurrentUser) -> Page {
    let avisos = db::notifications(&st.pool, user.id)
        .await?
        .into_iter()
        .map(|n| AvisoRow {
            when: n.created_at.with_timezone(&chrono_tz::America::Santiago).format("%d-%m-%Y %H:%M").to_string(),
            unread: n.read_at.is_none(),
            jar_id: n.jar_id,
            body: n.body,
        })
        .collect();
    db::mark_read(&st.pool, user.id).await?;
    render(AvisosPage { title: "Avisos".into(), header: header(&st, &user).await?, avisos })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_foto_se_reduce_y_se_recodifica_a_jpeg() {
        let mut png = Vec::new();
        image::DynamicImage::new_rgba8(2000, 1000).write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png).unwrap();
        let jpeg = shrink_image(&png).expect("un PNG válido se acepta");
        assert_eq!(&jpeg[..2], [0xFF, 0xD8], "debe ser JPEG");
        let small = image::load_from_memory(&jpeg).unwrap();
        assert_eq!((small.width(), small.height()), (640, 320));
    }

    #[test]
    fn lo_que_no_es_imagen_se_rechaza() {
        assert!(shrink_image(b"esto no es una imagen").is_none());
        assert!(shrink_image(b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>").is_none());
        assert!(shrink_image(&[]).is_none());
    }

    #[test]
    fn fecha_de_meta_futura_y_hasta_50_anios() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 6).unwrap();
        let d = |y, m, day| NaiveDate::from_ymd_opt(y, m, day).unwrap();
        assert_eq!(check_goal_date(d(2026, 11, 6), today), Err("La fecha de la meta debe ser futura."));
        assert_eq!(check_goal_date(d(2076, 12, 31), today), Ok(()));
        assert_eq!(check_goal_date(d(2088, 12, 12), today), Err("La fecha de la meta puede ser como máximo en 50 años."));
        assert_eq!(max_goal_date(today), "2076-12-31");
    }

    #[test]
    fn campos_de_plan_con_valores_por_defecto() {
        assert_eq!(parse_plan_fields("", "", ""), Ok((Frequency::Monthly, PlanKind::Constant, 0)));
        assert_eq!(parse_plan_fields("semanal", "decreciente", ""), Ok((Frequency::Weekly, PlanKind::Decreasing, 1000)));
        assert_eq!(parse_plan_fields("diario", "creciente", "7,5"), Ok((Frequency::Daily, PlanKind::Increasing, 750)));
        assert!(parse_plan_fields("anual", "", "").is_err());
        assert!(parse_plan_fields("", "decreciente", "60").is_err());
    }
}

use askama::Template;
use axum::extract::{Path, Query, Request, State};
use axum::http::{Method, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::routing::{get, post};
use axum::{Form, Router};
use chrono::{Datelike, Duration, Months, NaiveDate};
use serde::Deserialize;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::auth::{self, CurrentUser, MaybeUser};
use crate::db::{self, Contribution, Jar, Member};
use crate::error::{AppResult, bad};
use crate::game::{self, Standing};
use crate::sim::{self, clp, parse_clp, parse_pct};
use crate::views::*;
use crate::{AppState, today};

type Page = AppResult<Html<String>>;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/entrar", get(auth::entrar))
        .route("/auth/callback", get(auth::callback))
        .route("/salir", post(auth::salir))
        .route("/jarrones", get(jars).post(create_jar))
        .route("/jarrones/nuevo", get(new_jar))
        .route("/jarrones/{id}", get(jar_page))
        .route("/jarrones/{id}/panel", get(panel))
        .route("/jarrones/{id}/simular", get(preview))
        .route("/jarrones/{id}/aportes", post(add_contribution))
        .route("/jarrones/{id}/aportes/{cid}/borrar", post(delete_contribution))
        .route("/jarrones/{id}/meta", post(update_goal))
        .route("/jarrones/{id}/retos", post(create_challenge))
        .route("/jarrones/{id}/salir", post(leave))
        .route("/jarrones/{id}/miembros/{uid}/sacar", post(remove_member))
        .route("/jarrones/{id}/invitacion", post(new_invite))
        .route("/jarrones/{id}/borrar", post(delete_jar))
        .route("/unirse/{code}", get(join))
        .route("/simular", get(simulator))
        .route("/avisos", get(notifications))
        .route("/privacidad", get(privacy))
        .route("/salud", get(health))
        .nest_service("/static", ServeDir::new(&state.config.static_dir))
        .layer(middleware::from_fn_with_state(state.clone(), same_origin))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// CSRF: SameSite=Lax no basta porque todos los *.cinderlink.cl cuentan como el mismo sitio.
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

fn month_year(d: NaiveDate) -> String {
    const MONTHS: [&str; 12] = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    format!("{} de {}", MONTHS[d.month0() as usize], d.year())
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

fn clean(input: &str, max: usize) -> Option<String> {
    let t = input.trim();
    (!t.is_empty() && t.chars().count() <= max).then(|| t.to_string())
}

fn parse_date(input: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(input.trim(), "%Y-%m-%d").ok()
}

fn parse_optional_future_date(input: &str) -> AppResult<Option<NaiveDate>> {
    if input.trim().is_empty() {
        return Ok(None);
    }
    let date = parse_date(input).ok_or_else(|| bad("La fecha no es válida."))?;
    let today = today();
    if date <= today || date.year() > today.year() + 50 {
        return Err(bad("La fecha de la meta debe ser futura."));
    }
    Ok(Some(date))
}

fn rate_bp(pct: f64) -> i32 {
    (pct * 100.0).round() as i32
}

async fn header(st: &AppState, user: &CurrentUser) -> AppResult<Option<Header>> {
    Ok(Some(Header { name: user.name.clone(), unread: db::unread_count(&st.pool, user.id).await? }))
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

async fn health(State(st): State<AppState>) -> AppResult<&'static str> {
    sqlx::query("select 1").execute(&st.pool).await?;
    Ok("ok")
}

async fn jars(State(st): State<AppState>, user: CurrentUser) -> Page {
    let today = today();
    let jars = db::list_jars(&st.pool, user.id)
        .await?
        .into_iter()
        .map(|j| JarCard {
            reminder: j.total < j.goal_amount && !j.my_last_on.is_some_and(|d| game::contributed_this_month(&[d], today)),
            pct: game::pct(j.total, j.goal_amount),
            total: clp(j.total),
            goal: clp(j.goal_amount),
            kind: if j.kind == "grupal" { "Grupal" } else { "Individual" },
            category: category_label(&j.category),
            members: j.members,
            id: j.id,
            name: j.name,
        })
        .collect();
    render(JarsPage { title: "Mis jarrones".into(), header: header(&st, &user).await?, jars })
}

async fn new_jar(State(st): State<AppState>, user: CurrentUser) -> Page {
    render(NewJarPage { title: "Nuevo jarrón".into(), header: header(&st, &user).await? })
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
    let new = db::NewJar { kind, name: &name, category, goal, target_date, rate_bp: rate_bp(rate) };
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
}

async fn load(st: &AppState, jar_id: Uuid, user: Uuid) -> AppResult<Loaded> {
    let jar = db::require_member(&st.pool, jar_id, user).await?;
    let (members, contribs) = tokio::try_join!(db::members(&st.pool, jar.id), db::contributions(&st.pool, jar.id))?;
    Ok(Loaded { jar, members, contribs })
}

fn build_panel(l: &Loaded, today: NaiveDate) -> Panel {
    let goal = l.jar.goal_amount;
    let total = l.total();
    let share = game::share_per_member(goal, l.active_count());

    let mut active: Vec<(Standing, Uuid, u32)> = l
        .members
        .iter()
        .filter(|m| m.left_at.is_none())
        .map(|m| {
            let items = l.user_items(m.user_id);
            let dates: Vec<NaiveDate> = items.iter().map(|(d, _)| *d).collect();
            let total = items.iter().map(|(_, a)| a).sum();
            (Standing { name: m.name.clone(), total, share }, m.user_id, game::week_streak(&dates, today))
        })
        .collect();
    game::rank(&mut active, |row| &row.0);

    let mut members: Vec<MemberRow> = active
        .into_iter()
        .enumerate()
        .map(|(i, (s, user_id, streak))| MemberRow {
            user_id,
            share_pct: game::pct(s.total, s.share),
            total: clp(s.total),
            name: s.name,
            streak,
            active: true,
            position: i + 1,
        })
        .collect();
    // Quien salió conserva sus aportes en el total, pero no cuenta para cuota ni ranking.
    for m in l.members.iter().filter(|m| m.left_at.is_some()) {
        let total = l.user_items(m.user_id).iter().map(|(_, a)| a).sum();
        members.push(MemberRow { user_id: m.user_id, name: m.name.clone(), total: clp(total), share_pct: 0, streak: 0, active: false, position: 0 });
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

async fn jar_page(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> Page {
    let l = load(&st, id, user.id).await?;
    let today = today();
    let jar = &l.jar;
    let goal = jar.goal_amount;
    let total = l.total();
    let mine = l.user_items(user.id);
    let my_total: i64 = mine.iter().map(|(_, a)| a).sum();
    let my_dates: Vec<NaiveDate> = mine.iter().map(|(d, _)| *d).collect();
    let share = game::share_per_member(goal, l.active_count());

    let r = sim::monthly_rate(jar.savings_rate_bp);
    let months = jar.target_date.and_then(|t| sim::months_until(today, t));
    let plan = PlanView {
        has_date: jar.target_date.is_some(),
        date_passed: jar.target_date.is_some() && months.is_none(),
        target: jar.target_date.map(fmt_date).unwrap_or_default(),
        months_left: months.unwrap_or(0),
        group_monthly: clp(months.map_or(0, |m| sim::monthly_payment(goal, total, m, r))),
        my_monthly: clp(months.map_or(0, |m| sim::monthly_payment(share, my_total, m, r))),
    };

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

    let contributions = l
        .contribs
        .iter()
        .map(|c| ContribRow {
            id: c.id,
            name: c.name.clone(),
            amount: clp(c.amount),
            date: fmt_date(c.contributed_on),
            note: c.note.clone().unwrap_or_default(),
            mine: c.user_id == user.id,
        })
        .collect();
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
        reminder: total < goal && !game::contributed_this_month(&my_dates, today),
        panel: build_panel(&l, today),
        plan,
        chart,
        contributions,
        challenges,
        others,
        today: today.format("%Y-%m-%d").to_string(),
        goal_input: goal.to_string(),
        date_input: jar.target_date.map(|d| d.format("%Y-%m-%d").to_string()).unwrap_or_default(),
    })
}

async fn panel(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>) -> Page {
    let l = load(&st, id, user.id).await?;
    render(PanelFragment { panel: build_panel(&l, today()) })
}

#[derive(Deserialize)]
struct PreviewQuery {
    #[serde(default)]
    goal: String,
    #[serde(default)]
    target_date: String,
}

/// Simular juntos: la cuota con otra meta o fecha, sin guardar nada.
async fn preview(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Query(q): Query<PreviewQuery>) -> Page {
    let l = load(&st, id, user.id).await?;
    let fail = |message: &str| PreviewFragment { message: message.into(), group_monthly: String::new(), per_member: String::new(), months: 0, ok: false };
    let fragment = match (parse_clp(&q.goal), parse_date(&q.target_date)) {
        (Some(goal), Some(date)) => match sim::months_until(today(), date) {
            Some(months) => {
                let group = sim::monthly_payment(goal, l.total(), months, sim::monthly_rate(l.jar.savings_rate_bp));
                let people = l.active_count().max(1) as i64;
                PreviewFragment { message: String::new(), group_monthly: clp(group), per_member: clp((group + people - 1) / people), months, ok: true }
            }
            None => fail("La fecha debe ser futura."),
        },
        _ => fail("Escribe una meta y una fecha para ver la nueva cuota."),
    };
    render(fragment)
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
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
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
}

async fn update_goal(State(st): State<AppState>, user: CurrentUser, Path(id): Path<Uuid>, Form(f): Form<GoalForm>) -> AppResult<Redirect> {
    let jar = db::require_member(&st.pool, id, user.id).await?;
    let goal = parse_clp(&f.goal).ok_or_else(|| bad("La meta debe ser un monto mayor que cero."))?;
    let target = parse_optional_future_date(&f.target_date)?;
    let when = target.map(|d| format!(" para el {}", fmt_date(d))).unwrap_or_default();
    let notice = format!("{} cambió la meta de «{}» a {}{when}", user.name, jar.name, clp(goal));
    db::update_goal(&st.pool, jar.id, user.id, goal, target, &notice).await?;
    Ok(Redirect::to(&format!("/jarrones/{}", jar.id)))
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
    if input.trim().is_empty() { Ok(0) } else { parse_clp(input).ok_or("Revisa el monto ya ahorrado.") }
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
    let costs = if q.costos.trim().is_empty() { 0 } else { parse_clp(&q.costos).ok_or("Revisa los costos fijos.")? };
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

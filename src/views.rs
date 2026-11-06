//! Estructuras que ven las plantillas Askama. Los montos llegan ya formateados.

use askama::Template;
use uuid::Uuid;

pub struct Header {
    pub name: String,
    pub unread: i64,
}

#[derive(Template)]
#[template(path = "index.html")]
pub struct IndexPage {
    pub title: String,
    pub header: Option<Header>,
}

#[derive(Template)]
#[template(path = "error.html")]
pub struct ErrorPage {
    pub title: String,
    pub header: Option<Header>,
    pub message: String,
}

#[derive(Template)]
#[template(path = "privacidad.html")]
pub struct PrivacyPage {
    pub title: String,
    pub header: Option<Header>,
}

pub struct JarCard {
    pub id: Uuid,
    pub name: String,
    pub kind: &'static str,
    pub category: &'static str,
    pub total: String,
    pub goal: String,
    pub pct: u32,
    pub members: i64,
    pub reminder: bool,
    pub reminder_period: &'static str,
    pub priority: i16,
    /// Dirección de la foto; vacío si no tiene.
    pub image: String,
    pub emoji: &'static str,
    pub owner: bool,
}

#[derive(Template)]
#[template(path = "jars.html")]
pub struct JarsPage {
    pub title: String,
    pub header: Option<Header>,
    pub jars: Vec<JarCard>,
}

#[derive(Template)]
#[template(path = "jar_new.html")]
pub struct NewJarPage {
    pub title: String,
    pub header: Option<Header>,
}

pub struct MemberRow {
    pub user_id: Uuid,
    pub name: String,
    pub total: String,
    pub share_pct: u32,
    pub streak: u32,
    pub active: bool,
    pub position: usize,
}

pub struct Panel {
    pub jar_id: Uuid,
    pub group: bool,
    /// Unidad de la racha en plural: "días", "semanas" o "meses".
    pub streak_unit: &'static str,
    pub total: String,
    pub goal: String,
    pub missing: String,
    pub pct: u32,
    pub share: String,
    pub members: Vec<MemberRow>,
}

pub struct ContribRow {
    pub id: Uuid,
    pub name: String,
    pub amount: String,
    pub date: String,
    pub note: String,
    pub mine: bool,
}

pub struct ChallengeMember {
    pub name: String,
    pub pct: u32,
    pub done: bool,
}

pub struct ChallengeRow {
    pub title: String,
    pub amount: String,
    pub range: String,
    pub open: bool,
    pub members: Vec<ChallengeMember>,
}

/// Una cuota futura del plan: "noviembre de 2026" → "$120.000".
pub struct UpcomingRow {
    pub label: String,
    pub amount: String,
}

pub struct PlanView {
    pub has_date: bool,
    pub date_passed: bool,
    pub target: String,
    pub periods_left: u32,
    /// Unidad en plural y en singular: "meses" / "mes".
    pub unit: &'static str,
    pub unit_one: &'static str,
    pub this_period: &'static str,
    pub kind_label: String,
    pub free: bool,
    pub group_now: String,
    pub my_now: String,
    pub upcoming: Vec<UpcomingRow>,
}

pub struct PaceOption {
    pub label: &'static str,
    pub amount: String,
    pub arrival: String,
}

pub struct PaceView {
    pub has_pace: bool,
    pub message: String,
    pub avg: String,
    pub unit_one: &'static str,
    pub arrival: String,
    pub verdict: String,
    pub options: Vec<PaceOption>,
}

pub struct Chart {
    pub has_data: bool,
    pub points: String,
    pub goal_y: String,
    pub from: String,
    pub to: String,
}

pub struct OtherMember {
    pub id: Uuid,
    pub name: String,
}

#[derive(Template)]
#[template(path = "jar.html")]
pub struct JarPage {
    pub title: String,
    pub header: Option<Header>,
    pub jar_id: Uuid,
    pub name: String,
    pub category: &'static str,
    pub group: bool,
    pub owner: bool,
    pub invite_url: String,
    pub reminder: bool,
    pub panel: Panel,
    pub plan: PlanView,
    pub pace: PaceView,
    /// Dirección de la foto; vacío si no tiene.
    pub image: String,
    pub emoji: &'static str,
    pub reminder_period: &'static str,
    pub frequency_input: &'static str,
    pub kind_input: &'static str,
    pub step_input: String,
    pub chart: Chart,
    pub contributions: Vec<ContribRow>,
    pub challenges: Vec<ChallengeRow>,
    pub others: Vec<OtherMember>,
    pub today: String,
    pub goal_input: String,
    pub date_input: String,
}

#[derive(Template)]
#[template(path = "preview.html")]
pub struct PreviewFragment {
    pub ok: bool,
    pub message: String,
    pub periods: u32,
    pub unit: &'static str,
    pub unit_one: &'static str,
    pub this_period: &'static str,
    pub free: bool,
    pub now: String,
    /// Cuota por persona; vacío si no hay grupo o coincide con la del jarrón.
    pub per_member: String,
    pub upcoming: Vec<UpcomingRow>,
}

pub struct CuotaResult {
    pub monthly: String,
    pub per_person: String,
    pub months: u32,
    pub people: u32,
}

pub struct FechaResult {
    pub months: u32,
    pub date: String,
}

pub struct CuotasResult {
    pub cuota: String,
    pub total: String,
    pub sobrecosto: String,
    pub months_saving: String,
}

#[derive(Default)]
pub struct SimForm {
    pub meta: String,
    pub ahorrado: String,
    pub fecha: String,
    pub personas: String,
    pub tasa: String,
    pub aporte: String,
    pub precio: String,
    pub n: String,
    pub tasa_cuota: String,
    pub costos: String,
}

#[derive(Template)]
#[template(path = "simular.html")]
pub struct SimPage {
    pub title: String,
    pub header: Option<Header>,
    pub modo: String,
    pub form: SimForm,
    pub error: String,
    pub cuota: Option<CuotaResult>,
    pub fecha: Option<FechaResult>,
    pub cuotas: Option<CuotasResult>,
}

pub struct AvisoRow {
    pub body: String,
    pub when: String,
    pub unread: bool,
    pub jar_id: Option<Uuid>,
}

#[derive(Template)]
#[template(path = "avisos.html")]
pub struct AvisosPage {
    pub title: String,
    pub header: Option<Header>,
    pub avisos: Vec<AvisoRow>,
}

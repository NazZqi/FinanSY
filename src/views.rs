//! Estructuras que ven las plantillas Askama. Los montos llegan ya formateados.

use askama::Template;
use uuid::Uuid;

pub struct Header {
    pub name: String,
    pub initials: String,
    pub unread: i64,
    /// Semanas seguidas con al menos un aporte, en cualquier jarrón.
    pub streak: u32,
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
    pub today_long: String,
    pub tomorrow: String,
    pub me_name: String,
    pub me_initials: String,
}

/// Resumen del jarrón para la columna de contexto de «Registrar ahorro».
pub struct JarContext {
    pub id: Uuid,
    pub name: String,
    pub group: bool,
    pub people: usize,
    /// Los jarrones de viaje usan la foto de portada del diseño; el resto, una portada lisa.
    pub cover: bool,
    pub goal: String,
    pub total: String,
    pub pct: u32,
    pub target_short: String,
}

#[derive(Template)]
#[template(path = "aportar.html")]
pub struct ContributePage {
    pub title: String,
    pub header: Option<Header>,
    pub jar: JarContext,
    pub goal_raw: i64,
    pub total_raw: i64,
    pub my_total_raw: i64,
    pub my_total: String,
    pub initials: String,
    pub today: String,
    pub min_date: String,
    pub today_long: String,
    pub streak: u32,
}

pub struct MemberRow {
    pub name: String,
    pub initials: String,
    /// Color del avatar (0 a 3), estable por persona.
    pub tone: u8,
    pub mine: bool,
    pub total: String,
    /// Último registro: «+ $80.000 hoy», «Hace 2 días», «Sin registros».
    pub last: String,
    pub last_today: bool,
    /// Parte del total juntado: etiqueta «27,5%» y ancho CSS «27.5».
    pub part_label: String,
    pub part_width: String,
    pub active: bool,
    pub position: usize,
}

pub struct Panel {
    pub jar_id: Uuid,
    pub group: bool,
    pub total: String,
    pub goal: String,
    pub missing: String,
    pub pct: u32,
    pub share: String,
    pub members: Vec<MemberRow>,
}

#[derive(Template)]
#[template(path = "panel_fragment.html")]
pub struct PanelFragment {
    pub panel: Panel,
}

pub struct ContribRow {
    pub id: Uuid,
    pub name: String,
    pub initials: String,
    pub tone: u8,
    pub amount: String,
    pub date: String,
    /// «Hoy», «Ayer», «Hace 3 días» o la fecha corta.
    pub when: String,
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

pub struct PlanView {
    pub has_date: bool,
    pub date_passed: bool,
    pub target: String,
    pub months_left: u32,
    pub group_monthly: String,
    pub my_monthly: String,
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
    pub people: usize,
    pub cover: bool,
    pub today_long: String,
    /// Monto recién registrado (para el aviso de confirmación) y la hora.
    pub banner: Option<String>,
    pub banner_time: String,
    pub total: String,
    pub goal: String,
    pub missing: String,
    pub pct: u32,
    pub last_mine: Option<String>,
    pub days_left: Option<i64>,
    pub target_long: String,
    pub streak: u32,
    pub milestone: String,
    pub recent: Vec<ContribRow>,
    pub panel: Panel,
    pub plan: PlanView,
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
    pub message: String,
    pub group_monthly: String,
    pub per_member: String,
    pub months: u32,
    pub ok: bool,
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

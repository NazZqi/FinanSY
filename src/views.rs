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

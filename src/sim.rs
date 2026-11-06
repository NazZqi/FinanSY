//! Simulador de ahorro: funciones puras, sin base de datos.
//! Montos en pesos chilenos enteros; las tasas se calculan en f64 y se redondean al final.

use chrono::{Datelike, Duration, Months, NaiveDate};

/// Cada cuánto aporta quien ahorra. Mensual es lo más común: se ahorra a principio de mes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Frequency {
    Daily,
    Weekly,
    Monthly,
}

impl Frequency {
    pub fn parse(input: &str) -> Option<Self> {
        match input {
            "diario" => Some(Self::Daily),
            "semanal" => Some(Self::Weekly),
            "mensual" => Some(Self::Monthly),
            _ => None,
        }
    }

    /// Valor guardado en la base de datos.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Daily => "diario",
            Self::Weekly => "semanal",
            Self::Monthly => "mensual",
        }
    }

    fn per_year(self) -> f64 {
        match self {
            Self::Daily => 365.0,
            Self::Weekly => 52.0,
            Self::Monthly => 12.0,
        }
    }

    /// Unidad en singular o plural: "mes" / "meses".
    pub fn unit(self, plural: bool) -> &'static str {
        match (self, plural) {
            (Self::Daily, false) => "día",
            (Self::Daily, true) => "días",
            (Self::Weekly, false) => "semana",
            (Self::Weekly, true) => "semanas",
            (Self::Monthly, false) => "mes",
            (Self::Monthly, true) => "meses",
        }
    }

    pub fn this_period(self) -> &'static str {
        match self {
            Self::Daily => "hoy",
            Self::Weekly => "esta semana",
            Self::Monthly => "este mes",
        }
    }

    /// 50 años en esta unidad: el tope antes de responder "no alcanza".
    pub fn max_periods(self) -> u32 {
        (self.per_year() * 50.0) as u32
    }
}

/// Forma de las cuotas: iguales, bajando, subiendo o a gusto (se recalculan con lo que falta).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanKind {
    Constant,
    Decreasing,
    Increasing,
    Free,
}

impl PlanKind {
    pub fn parse(input: &str) -> Option<Self> {
        match input {
            "constante" => Some(Self::Constant),
            "decreciente" => Some(Self::Decreasing),
            "creciente" => Some(Self::Increasing),
            "libre" => Some(Self::Free),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Constant => "constante",
            Self::Decreasing => "decreciente",
            Self::Increasing => "creciente",
            Self::Free => "libre",
        }
    }

    /// Razón entre una cuota y la siguiente: 1 = igual, 0,9 = baja 10 %, 1,1 = sube 10 %.
    pub fn growth(self, step_bp: i32) -> f64 {
        let step = f64::from(step_bp) / 10_000.0;
        match self {
            Self::Constant | Self::Free => 1.0,
            Self::Decreasing => 1.0 - step,
            Self::Increasing => 1.0 + step,
        }
    }
}

/// Tope de meses que el simulador recorre antes de responder "no alcanza".
pub const MAX_MONTHS: u32 = 600;

/// Tasa mensual efectiva equivalente a una tasa anual expresada en puntos básicos (450 = 4,5 %).
pub fn monthly_rate(annual_bp: i32) -> f64 {
    (1.0 + f64::from(annual_bp) / 10_000.0).powf(1.0 / 12.0) - 1.0
}

/// Tasa efectiva por período (día, semana o mes) para una tasa anual en puntos básicos.
pub fn period_rate(annual_bp: i32, freq: Frequency) -> f64 {
    (1.0 + f64::from(annual_bp) / 10_000.0).powf(1.0 / freq.per_year()) - 1.0
}

/// Aporte mensual para llegar a `goal` en `months` meses partiendo de `saved`, con tasa mensual `r`.
/// Redondea hacia arriba para no quedar corto. Devuelve 0 si la meta ya está cumplida.
pub fn monthly_payment(goal: i64, saved: i64, months: u32, r: f64) -> i64 {
    let n = months.max(1);
    let growth = (1.0 + r).powi(n as i32);
    let missing = goal as f64 - saved as f64 * growth;
    if missing <= 0.0 {
        return 0;
    }
    let payment = if r == 0.0 { missing / f64::from(n) } else { missing * r / (growth - 1.0) };
    payment.ceil() as i64
}

/// Períodos que toma llegar a `goal` aportando `payment` en cada uno. `None` si pasa de `max`.
pub fn periods_to_goal(goal: i64, saved: i64, payment: i64, r: f64, max: u32) -> Option<u32> {
    if saved >= goal {
        return Some(0);
    }
    let mut balance = saved as f64;
    for period in 1..=max {
        balance = balance * (1.0 + r) + payment as f64;
        // Medio peso de holgura para no perder un período por redondeo.
        if balance + 0.5 >= goal as f64 {
            return Some(period);
        }
    }
    None
}

/// Meses que toma llegar a `goal` aportando `payment` al mes. `None` si pasa de `MAX_MONTHS`.
pub fn months_to_goal(goal: i64, saved: i64, payment: i64, r: f64) -> Option<u32> {
    periods_to_goal(goal, saved, payment, r, MAX_MONTHS)
}

/// Meses calendario que quedan entre `today` y `target`. `None` si la fecha ya pasó.
/// Si la fecha cae en el mes actual queda 1 mes.
pub fn months_until(today: NaiveDate, target: NaiveDate) -> Option<u32> {
    if target <= today {
        return None;
    }
    let months = (target.year() - today.year()) * 12 + target.month() as i32 - today.month() as i32;
    Some(months.max(1) as u32)
}

/// Períodos que quedan entre `today` y `target`. `None` si la fecha ya pasó.
pub fn periods_until(today: NaiveDate, target: NaiveDate, freq: Frequency) -> Option<u32> {
    if target <= today {
        return None;
    }
    let days = (target - today).num_days();
    match freq {
        Frequency::Monthly => months_until(today, target),
        Frequency::Weekly => Some(((days + 6) / 7) as u32),
        Frequency::Daily => Some(days as u32),
    }
}

/// Períodos transcurridos entre `first` y `today`, contando el período de `first` y el actual (mínimo 1).
pub fn periods_between(first: NaiveDate, today: NaiveDate, freq: Frequency) -> u32 {
    let days = (today - first).num_days().max(0);
    match freq {
        Frequency::Monthly => ((today.year() - first.year()) * 12 + today.month() as i32 - first.month() as i32 + 1).max(1) as u32,
        Frequency::Weekly => (days / 7 + 1) as u32,
        Frequency::Daily => (days + 1) as u32,
    }
}

/// Fecha que resulta de sumar `n` períodos a `date`.
pub fn add_periods(date: NaiveDate, n: u32, freq: Frequency) -> NaiveDate {
    match freq {
        Frequency::Monthly => date.checked_add_months(Months::new(n)).unwrap_or(date),
        Frequency::Weekly => date + Duration::weeks(i64::from(n)),
        Frequency::Daily => date + Duration::days(i64::from(n)),
    }
}

/// Cuota del período actual para llegar a `goal` en `n` períodos, con cuotas que cambian por la razón `g`
/// (1 = iguales). Con `g = 1` coincide con `monthly_payment`. Redondea hacia arriba.
pub fn first_payment(goal: i64, saved: i64, n: u32, r: f64, g: f64) -> i64 {
    let n = n.max(1);
    let growth = (1.0 + r).powi(n as i32);
    let missing = goal as f64 - saved as f64 * growth;
    if missing <= 0.0 {
        return 0;
    }
    // Valor futuro de una cuota inicial de 1: suma de g^(k-1)·(1+r)^(n-k).
    let factor = if ((1.0 + r) - g).abs() < 1e-12 {
        f64::from(n) * (1.0 + r).powi(n as i32 - 1)
    } else {
        (growth - g.powi(n as i32)) / ((1.0 + r) - g)
    };
    (missing / factor).ceil() as i64
}

/// Cuota del período `k` (0 = el actual) para una cuota inicial `first` y razón `g`.
pub fn payment_at(first: i64, g: f64, k: u32) -> i64 {
    (first as f64 * g.powi(k as i32)).ceil() as i64
}

#[derive(Debug, PartialEq)]
pub struct Installments {
    pub cuota: i64,
    pub total: i64,
    pub sobrecosto: i64,
}

/// Compra en cuotas con amortización francesa (portada de `src/utils/amortization.ts` de la v2).
/// `monthly_rate_pct` es la tasa mensual en porcentaje (1.5 = 1,5 %).
pub fn installments(price: i64, n: u32, monthly_rate_pct: f64, fixed_costs: i64) -> Installments {
    if price <= 0 || n == 0 {
        return Installments { cuota: 0, total: 0, sobrecosto: 0 };
    }
    let i = monthly_rate_pct / 100.0;
    let base = if i == 0.0 {
        price as f64 / f64::from(n)
    } else {
        let factor = (1.0 + i).powi(n as i32);
        price as f64 * (i * factor) / (factor - 1.0)
    };
    let cuota = base.round() as i64 + fixed_costs;
    let total = cuota * i64::from(n);
    Installments { cuota, total, sobrecosto: (total - price).max(0) }
}

#[derive(Debug, PartialEq)]
pub struct SaveVsInstallments {
    pub plan: Installments,
    /// Meses para juntar el precio ahorrando la misma cuota. `None` si no alcanza.
    pub months_saving: Option<u32>,
}

/// Compara comprar ya en cuotas con ahorrar la misma cuota cada mes hasta juntar el precio.
pub fn save_vs_installments(
    price: i64,
    n: u32,
    monthly_rate_pct: f64,
    fixed_costs: i64,
    savings_annual_bp: i32,
) -> SaveVsInstallments {
    let plan = installments(price, n, monthly_rate_pct, fixed_costs);
    let months_saving = months_to_goal(price, 0, plan.cuota, monthly_rate(savings_annual_bp));
    SaveVsInstallments { plan, months_saving }
}

/// Formato chileno: 1500000 → "$1.500.000".
pub fn clp(amount: i64) -> String {
    let digits = amount.unsigned_abs().to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    if amount < 0 { format!("-${out}") } else { format!("${out}") }
}

/// Lee un monto escrito por una persona: "$1.500.000", "20 000" o "20000".
/// Rechaza vacío, cero y montos sobre 10.000 millones.
pub fn parse_clp(input: &str) -> Option<i64> {
    let mut digits = String::new();
    for ch in input.trim().chars() {
        match ch {
            '0'..='9' => digits.push(ch),
            '$' | '.' | ' ' | '\u{a0}' => {}
            _ => return None,
        }
    }
    if digits.is_empty() || digits.len() > 11 {
        return None;
    }
    let value: i64 = digits.parse().ok()?;
    (1..=10_000_000_000).contains(&value).then_some(value)
}

/// Lee un porcentaje con coma o punto decimal ("1,5" o "1.5") y lo valida entre 0 y 100.
pub fn parse_pct(input: &str) -> Option<f64> {
    let cleaned = input.trim().trim_end_matches('%').trim().replace(',', ".");
    if cleaned.is_empty() {
        return Some(0.0);
    }
    let value: f64 = cleaned.parse().ok()?;
    (value.is_finite() && (0.0..=100.0).contains(&value)).then_some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    #[test]
    fn cuota_igual_a_la_version_ts() {
        // Misma entrada que calculateAmortization en la v2: 1.000.000, 12 cuotas, 1,5 % mensual.
        let plan = installments(1_000_000, 12, 1.5, 0);
        assert_eq!(plan, Installments { cuota: 91_680, total: 1_100_160, sobrecosto: 100_160 });
    }

    #[test]
    fn cuotas_sin_interes_y_con_costos_fijos() {
        assert_eq!(installments(1_200_000, 12, 0.0, 0).cuota, 100_000);
        assert_eq!(installments(1_200_000, 12, 0.0, 5_000).total, 1_260_000);
    }

    #[test]
    fn aporte_mensual_sin_interes() {
        assert_eq!(monthly_payment(1_500_000, 0, 10, 0.0), 150_000);
        assert_eq!(monthly_payment(1_000_000, 0, 3, 0.0), 333_334);
    }

    #[test]
    fn aporte_mensual_con_interes_es_menor() {
        let r = monthly_rate(600);
        let con = monthly_payment(1_500_000, 0, 10, r);
        assert!(con < 150_000 && con > 145_000, "con interés: {con}");
    }

    #[test]
    fn meta_cumplida_no_pide_aporte() {
        assert_eq!(monthly_payment(500_000, 600_000, 5, 0.0), 0);
        assert_eq!(months_to_goal(500_000, 500_000, 10_000, 0.0), Some(0));
    }

    #[test]
    fn meses_para_llegar() {
        assert_eq!(months_to_goal(600_000, 0, 50_000, 0.0), Some(12));
        assert_eq!(months_to_goal(600_000, 100_000, 50_000, 0.0), Some(10));
        assert_eq!(months_to_goal(600_000, 0, 0, 0.0), None);
        assert_eq!(months_to_goal(10_000_000_000, 0, 1, 0.0), None);
    }

    #[test]
    fn cuota_inicial_con_razon_uno_iguala_la_constante() {
        for bp in [0, 600] {
            let r = monthly_rate(bp);
            assert_eq!(first_payment(1_500_000, 200_000, 10, r, 1.0), monthly_payment(1_500_000, 200_000, 10, r));
        }
    }

    #[test]
    fn plan_decreciente_parte_mas_alto_y_llega_a_la_meta() {
        for bp in [0, 600] {
            let r = monthly_rate(bp);
            let constant = first_payment(1_000_000, 0, 10, r, 1.0);
            let first = first_payment(1_000_000, 0, 10, r, 0.9);
            assert!(first > constant, "{first} > {constant}");
            let mut balance = 0.0;
            for k in 0..10 {
                balance = balance * (1.0 + r) + payment_at(first, 0.9, k) as f64;
            }
            assert!((1_000_000.0..1_000_100.0).contains(&balance), "saldo final {balance}");
        }
    }

    #[test]
    fn plan_creciente_parte_mas_bajo() {
        let r = monthly_rate(0);
        assert!(first_payment(1_000_000, 0, 10, r, 1.1) < first_payment(1_000_000, 0, 10, r, 1.0));
    }

    #[test]
    fn razon_igual_a_la_tasa_no_divide_por_cero() {
        let r = 0.01;
        let p = first_payment(1_000_000, 0, 12, r, 1.0 + r);
        assert!(p > 0 && p < 1_000_000);
    }

    #[test]
    fn periodos_hasta_una_fecha_segun_frecuencia() {
        let today = d(2026, 11, 3);
        assert_eq!(periods_until(today, d(2026, 11, 10), Frequency::Weekly), Some(1));
        assert_eq!(periods_until(today, d(2026, 11, 11), Frequency::Weekly), Some(2));
        assert_eq!(periods_until(today, d(2026, 11, 13), Frequency::Daily), Some(10));
        assert_eq!(periods_until(today, d(2027, 7, 15), Frequency::Monthly), Some(8));
        assert_eq!(periods_until(today, today, Frequency::Daily), None);
    }

    #[test]
    fn periodos_transcurridos_incluyen_el_primero_y_el_actual() {
        assert_eq!(periods_between(d(2026, 11, 20), d(2026, 11, 25), Frequency::Monthly), 1);
        assert_eq!(periods_between(d(2026, 10, 31), d(2027, 1, 2), Frequency::Monthly), 4);
        assert_eq!(periods_between(d(2026, 11, 3), d(2026, 11, 3), Frequency::Weekly), 1);
        assert_eq!(periods_between(d(2026, 11, 3), d(2026, 11, 17), Frequency::Weekly), 3);
        assert_eq!(periods_between(d(2026, 11, 3), d(2026, 11, 5), Frequency::Daily), 3);
    }

    #[test]
    fn sumar_periodos() {
        assert_eq!(add_periods(d(2026, 1, 31), 1, Frequency::Monthly), d(2026, 2, 28));
        assert_eq!(add_periods(d(2026, 11, 3), 2, Frequency::Weekly), d(2026, 11, 17));
        assert_eq!(add_periods(d(2026, 11, 3), 30, Frequency::Daily), d(2026, 12, 3));
    }

    #[test]
    fn diario_necesita_un_tope_mayor_que_el_mensual() {
        assert_eq!(periods_to_goal(1_000_000, 0, 1_000, 0.0, 600), None);
        assert_eq!(periods_to_goal(1_000_000, 0, 1_000, 0.0, Frequency::Daily.max_periods()), Some(1_000));
    }

    #[test]
    fn ahorrar_vs_cuotas() {
        let cmp = save_vs_installments(1_000_000, 12, 1.5, 0, 0);
        assert_eq!(cmp.plan.sobrecosto, 100_160);
        assert_eq!(cmp.months_saving, Some(11));
    }

    #[test]
    fn meses_hasta_una_fecha() {
        assert_eq!(months_until(d(2026, 11, 3), d(2027, 7, 15)), Some(8));
        assert_eq!(months_until(d(2026, 11, 3), d(2026, 11, 30)), Some(1));
        assert_eq!(months_until(d(2026, 11, 3), d(2026, 11, 3)), None);
        assert_eq!(months_until(d(2026, 11, 3), d(2026, 10, 1)), None);
    }

    #[test]
    fn formato_y_lectura_de_pesos() {
        assert_eq!(clp(1_500_000), "$1.500.000");
        assert_eq!(clp(999), "$999");
        assert_eq!(clp(-20_000), "-$20.000");
        assert_eq!(parse_clp("$1.500.000"), Some(1_500_000));
        assert_eq!(parse_clp(" 20 000 "), Some(20_000));
        assert_eq!(parse_clp(""), None);
        assert_eq!(parse_clp("0"), None);
        assert_eq!(parse_clp("abc"), None);
        assert_eq!(parse_clp("99999999999999999999"), None);
    }

    #[test]
    fn lectura_de_porcentajes() {
        assert_eq!(parse_pct("1,5"), Some(1.5));
        assert_eq!(parse_pct("4.5 %"), Some(4.5));
        assert_eq!(parse_pct(""), Some(0.0));
        assert_eq!(parse_pct("101"), None);
        assert_eq!(parse_pct("-1"), None);
    }
}

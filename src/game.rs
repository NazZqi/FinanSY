//! Lo interactivo del jarrón grupal: rachas, ranking, retos y gráfico. Funciones puras.

use std::collections::HashSet;

use chrono::{Datelike, Duration, IsoWeek, NaiveDate};

/// Semanas ISO seguidas con al menos un aporte. Cuenta desde la semana actual,
/// o desde la anterior si en esta todavía no hay aporte.
pub fn week_streak(dates: &[NaiveDate], today: NaiveDate) -> u32 {
    let weeks: HashSet<IsoWeek> = dates.iter().map(|d| d.iso_week()).collect();
    let mut cursor = today;
    if !weeks.contains(&cursor.iso_week()) {
        cursor -= Duration::days(7);
    }
    let mut streak = 0;
    while weeks.contains(&cursor.iso_week()) {
        streak += 1;
        cursor -= Duration::days(7);
    }
    streak
}

/// ¿Hay un aporte en el mes calendario de `today`?
pub fn contributed_this_month(dates: &[NaiveDate], today: NaiveDate) -> bool {
    dates.iter().any(|d| d.year() == today.year() && d.month() == today.month())
}

/// Suma de aportes entre `from` y `to`, ambos incluidos.
pub fn sum_in_range(items: &[(NaiveDate, i64)], from: NaiveDate, to: NaiveDate) -> i64 {
    items.iter().filter(|(d, _)| (from..=to).contains(d)).map(|(_, amount)| amount).sum()
}

/// Cuota de cada miembro activo: la meta dividida en partes iguales, redondeada hacia arriba.
pub fn share_per_member(goal: i64, active_members: usize) -> i64 {
    let n = active_members.max(1) as i64;
    (goal + n - 1) / n
}

/// Porcentaje entero de avance, con tope 100.
pub fn pct(part: i64, whole: i64) -> u32 {
    if whole <= 0 || part <= 0 {
        return 0;
    }
    (i128::from(part) * 100 / i128::from(whole)).min(100) as u32
}

#[derive(Debug, Clone, PartialEq)]
pub struct Standing {
    pub name: String,
    pub total: i64,
    pub share: i64,
}

/// Ordena por % de la cuota cumplida, luego por total aportado y luego por nombre.
pub fn rank(standings: &mut [Standing]) {
    // Compara total/cuota en enteros (producto cruzado) para no depender de f64.
    let ratio = |s: &Standing| (i128::from(s.total), i128::from(s.share.max(1)));
    standings.sort_by(|a, b| {
        let ((ta, sa), (tb, sb)) = (ratio(a), ratio(b));
        (tb * sa).cmp(&(ta * sb)).then(b.total.cmp(&a.total)).then(a.name.cmp(&b.name))
    });
}

/// Puntos de una polilínea SVG con el ahorro acumulado en escalera.
/// x va de `start` (0) a `end` (`w`); y va de 0 (abajo, `h`) a `max_y` (arriba, 0).
pub fn cumulative_points(items: &[(NaiveDate, i64)], start: NaiveDate, end: NaiveDate, max_y: i64, w: f64, h: f64) -> String {
    let span = (end - start).num_days().max(1) as f64;
    let x = |d: NaiveDate| ((d - start).num_days() as f64 / span * w).clamp(0.0, w);
    let y = |v: i64| (h - v as f64 / max_y.max(1) as f64 * h).clamp(0.0, h);
    let mut sorted = items.to_vec();
    sorted.sort_by_key(|(d, _)| *d);
    let mut points = vec![format!("0.0,{h:.1}")];
    let mut acc = 0;
    for (date, amount) in sorted {
        points.push(format!("{:.1},{:.1}", x(date), y(acc)));
        acc += amount;
        points.push(format!("{:.1},{:.1}", x(date), y(acc)));
    }
    points.push(format!("{w:.1},{:.1}", y(acc)));
    points.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    #[test]
    fn racha_cruza_el_cambio_de_anio() {
        // 2026 tiene semana ISO 53: 22-dic es S52, 29-dic es S53 y 5-ene-2027 es S1.
        let dates = [d(2026, 12, 22), d(2026, 12, 29), d(2027, 1, 5)];
        assert_eq!(week_streak(&dates, d(2027, 1, 6)), 3);
    }

    #[test]
    fn racha_sigue_viva_si_esta_semana_aun_no_aporta() {
        let dates = [d(2026, 12, 22), d(2026, 12, 29)];
        assert_eq!(week_streak(&dates, d(2027, 1, 6)), 2);
    }

    #[test]
    fn racha_se_corta_con_una_semana_sin_aportes() {
        let dates = [d(2026, 12, 8), d(2026, 12, 29)];
        assert_eq!(week_streak(&dates, d(2026, 12, 30)), 1);
        assert_eq!(week_streak(&[d(2026, 12, 8)], d(2026, 12, 30)), 0);
        assert_eq!(week_streak(&[], d(2026, 12, 30)), 0);
    }

    #[test]
    fn aporte_del_mes() {
        assert!(!contributed_this_month(&[d(2026, 10, 31)], d(2026, 11, 3)));
        assert!(contributed_this_month(&[d(2026, 11, 1)], d(2026, 11, 3)));
        assert!(!contributed_this_month(&[d(2025, 11, 10)], d(2026, 11, 3)));
    }

    #[test]
    fn suma_de_un_reto_incluye_los_bordes() {
        let items = [(d(2026, 11, 1), 10), (d(2026, 11, 15), 20), (d(2026, 11, 30), 30), (d(2026, 12, 1), 40)];
        assert_eq!(sum_in_range(&items, d(2026, 11, 1), d(2026, 11, 30)), 60);
    }

    #[test]
    fn cuota_y_porcentaje() {
        assert_eq!(share_per_member(1_000_000, 3), 333_334);
        assert_eq!(share_per_member(1_000_000, 0), 1_000_000);
        assert_eq!(pct(50, 200), 25);
        assert_eq!(pct(300, 200), 100);
        assert_eq!(pct(10, 0), 0);
    }

    #[test]
    fn ranking_por_porcentaje_y_total() {
        let s = |name: &str, total, share| Standing { name: name.into(), total, share };
        let mut list = vec![s("Ana", 100, 400), s("Beto", 300, 400), s("Caro", 300, 400), s("Dani", 50, 100)];
        rank(&mut list);
        let names: Vec<_> = list.iter().map(|x| x.name.as_str()).collect();
        assert_eq!(names, ["Beto", "Caro", "Dani", "Ana"]);
    }

    #[test]
    fn grafico_parte_en_cero_y_llega_al_total() {
        let items = [(d(2026, 11, 1), 50), (d(2026, 11, 11), 50)];
        let pts = cumulative_points(&items, d(2026, 11, 1), d(2026, 11, 11), 100, 100.0, 100.0);
        assert!(pts.starts_with("0.0,100.0 "), "{pts}");
        assert!(pts.ends_with(" 100.0,0.0"), "{pts}");
        assert!(pts.contains("0.0,50.0"), "{pts}");
    }
}

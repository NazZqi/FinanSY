//! Consultas a Postgres. Toda consulta sobre un jarrón pasa por `require_member` antes,
//! salvo las que ya filtran por dueño o por autor en su propio WHERE.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{FromRow, PgConnection, PgPool};
use uuid::Uuid;

use crate::error::{AppError, AppResult, bad};
use crate::sim::{Frequency, PlanKind};

#[derive(Debug, Clone, FromRow)]
pub struct Jar {
    pub id: Uuid,
    pub kind: String,
    pub name: String,
    pub category: String,
    pub goal_amount: i64,
    pub target_date: Option<NaiveDate>,
    pub savings_rate_bp: i32,
    pub invite_code: Option<String>,
    pub owner_id: Uuid,
    pub frequency: String,
    pub plan_kind: String,
    pub plan_step_bp: i32,
    pub image_at: Option<DateTime<Utc>>,
}

impl Jar {
    pub fn is_group(&self) -> bool {
        self.kind == "grupal"
    }

    // La base ya valida ambos valores con CHECK: el valor por defecto nunca se usa.
    pub fn freq(&self) -> Frequency {
        Frequency::parse(&self.frequency).unwrap_or(Frequency::Monthly)
    }

    pub fn plan(&self) -> PlanKind {
        PlanKind::parse(&self.plan_kind).unwrap_or(PlanKind::Constant)
    }
}

#[derive(Debug, FromRow)]
pub struct JarSummary {
    pub id: Uuid,
    pub name: String,
    pub kind: String,
    pub category: String,
    pub goal_amount: i64,
    pub total: i64,
    pub members: i64,
    pub my_last_on: Option<NaiveDate>,
    pub frequency: String,
    pub priority: Option<i16>,
    pub image_at: Option<DateTime<Utc>>,
    pub is_owner: bool,
}

#[derive(Debug, FromRow)]
pub struct Member {
    pub user_id: Uuid,
    pub name: String,
    pub left_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
pub struct Contribution {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub amount: i64,
    pub contributed_on: NaiveDate,
    pub note: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct Challenge {
    pub title: String,
    pub amount_per_member: i64,
    pub starts_on: NaiveDate,
    pub ends_on: NaiveDate,
}

#[derive(Debug, FromRow)]
pub struct Notification {
    pub body: String,
    pub jar_id: Option<Uuid>,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

pub struct NewJar<'a> {
    pub kind: &'a str,
    pub name: &'a str,
    pub category: &'a str,
    pub goal: i64,
    pub target_date: Option<NaiveDate>,
    pub rate_bp: i32,
    pub frequency: &'a str,
    pub plan_kind: &'a str,
    pub step_bp: i32,
    /// Primer aporte opcional, con fecha de hoy.
    pub first_amount: Option<i64>,
    pub today: NaiveDate,
}

/// 32 símbolos sin letras confundibles (i, l, o, 0): 10 caracteres ≈ 50 bits.
pub fn new_invite_code() -> String {
    const ALPHABET: &[u8; 32] = b"abcdefghjkmnpqrstuvwxyz123456789";
    rand::random::<[u8; 10]>().iter().map(|b| ALPHABET[(*b as usize) % 32] as char).collect()
}

pub async fn upsert_profile(pool: &PgPool, id: Uuid, name: &str, avatar_url: Option<&str>) -> AppResult<()> {
    sqlx::query(
        "insert into finansy.profiles (id, name, avatar_url) values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name, avatar_url = excluded.avatar_url",
    )
    .bind(id)
    .bind(name)
    .bind(avatar_url)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn create_jar(pool: &PgPool, owner: Uuid, new: &NewJar<'_>) -> AppResult<Uuid> {
    let invite = (new.kind == "grupal").then(new_invite_code);
    let mut tx = pool.begin().await?;
    let (id,): (Uuid,) = sqlx::query_as(
        "insert into finansy.jars (kind, name, category, goal_amount, target_date, savings_rate_bp, invite_code, owner_id, frequency, plan_kind, plan_step_bp)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id",
    )
    .bind(new.kind)
    .bind(new.name)
    .bind(new.category)
    .bind(new.goal)
    .bind(new.target_date)
    .bind(new.rate_bp)
    .bind(invite)
    .bind(owner)
    .bind(new.frequency)
    .bind(new.plan_kind)
    .bind(new.step_bp)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("insert into finansy.jar_members (jar_id, user_id) values ($1, $2)")
        .bind(id)
        .bind(owner)
        .execute(&mut *tx)
        .await?;
    if let Some(amount) = new.first_amount {
        sqlx::query("insert into finansy.contributions (jar_id, user_id, amount, contributed_on) values ($1, $2, $3, $4)")
            .bind(id)
            .bind(owner)
            .bind(amount)
            .bind(new.today)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(id)
}

pub async fn list_jars(pool: &PgPool, user: Uuid) -> AppResult<Vec<JarSummary>> {
    Ok(sqlx::query_as(
        "select j.id, j.name, j.kind, j.category, j.goal_amount,
                coalesce((select sum(c.amount) from finansy.contributions c where c.jar_id = j.id), 0)::bigint as total,
                (select count(*) from finansy.jar_members m2 where m2.jar_id = j.id and m2.left_at is null) as members,
                (select max(c.contributed_on) from finansy.contributions c where c.jar_id = j.id and c.user_id = $1) as my_last_on,
                j.frequency, m.priority, j.image_at, (j.owner_id = $1) as is_owner
         from finansy.jars j
         join finansy.jar_members m on m.jar_id = j.id
         where m.user_id = $1 and m.left_at is null
         order by m.priority nulls last, j.created_at desc",
    )
    .bind(user)
    .fetch_all(pool)
    .await?)
}

/// El jarrón solo si `user` es miembro activo. Si no, 404: no se revela que existe.
pub async fn require_member(pool: &PgPool, jar_id: Uuid, user: Uuid) -> AppResult<Jar> {
    sqlx::query_as(
        "select j.id, j.kind, j.name, j.category, j.goal_amount, j.target_date, j.savings_rate_bp, j.invite_code, j.owner_id,
                j.frequency, j.plan_kind, j.plan_step_bp, j.image_at
         from finansy.jars j
         join finansy.jar_members m on m.jar_id = j.id
         where j.id = $1 and m.user_id = $2 and m.left_at is null",
    )
    .bind(jar_id)
        .bind(user)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound)
}

pub async fn members(pool: &PgPool, jar_id: Uuid) -> AppResult<Vec<Member>> {
    Ok(sqlx::query_as(
        "select m.user_id, p.name, m.left_at from finansy.jar_members m
         join finansy.profiles p on p.id = m.user_id
         where m.jar_id = $1 order by m.joined_at",
    )
    .bind(jar_id)
    .fetch_all(pool)
    .await?)
}

pub async fn contributions(pool: &PgPool, jar_id: Uuid) -> AppResult<Vec<Contribution>> {
    Ok(sqlx::query_as(
        "select c.id, c.user_id, p.name, c.amount, c.contributed_on, c.note from finansy.contributions c
         join finansy.profiles p on p.id = c.user_id
         where c.jar_id = $1 order by c.contributed_on desc, c.created_at desc",
    )
    .bind(jar_id)
    .fetch_all(pool)
    .await?)
}

/// Avisa a los demás miembros activos del jarrón, dentro de la misma transacción que la acción.
async fn notify_others(conn: &mut PgConnection, jar_id: Uuid, except: Uuid, body: &str) -> AppResult<()> {
    sqlx::query(
        "insert into finansy.notifications (user_id, jar_id, body)
         select user_id, $1, $3 from finansy.jar_members
         where jar_id = $1 and left_at is null and user_id <> $2",
    )
    .bind(jar_id)
    .bind(except)
    .bind(body)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn add_contribution(
    pool: &PgPool,
    jar_id: Uuid,
    user: Uuid,
    amount: i64,
    on: NaiveDate,
    note: Option<&str>,
    notice: &str,
) -> AppResult<()> {
    let mut tx = pool.begin().await?;
    sqlx::query("insert into finansy.contributions (jar_id, user_id, amount, contributed_on, note) values ($1, $2, $3, $4, $5)")
        .bind(jar_id)
        .bind(user)
        .bind(amount)
        .bind(on)
        .bind(note)
        .execute(&mut *tx)
        .await?;
    notify_others(&mut tx, jar_id, user, notice).await?;
    tx.commit().await?;
    Ok(())
}

/// Solo borra aportes propios: el autor va en el WHERE.
pub async fn delete_contribution(pool: &PgPool, jar_id: Uuid, user: Uuid, id: Uuid) -> AppResult<()> {
    let done = sqlx::query("delete from finansy.contributions where id = $1 and jar_id = $2 and user_id = $3")
        .bind(id)
        .bind(jar_id)
        .bind(user)
        .execute(pool)
        .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Meta, fecha y plan del jarrón. Solo quien lo creó: para los demás el jarrón no cambia.
pub struct PlanChange<'a> {
    pub goal: i64,
    pub target_date: Option<NaiveDate>,
    pub frequency: &'a str,
    pub plan_kind: &'a str,
    pub step_bp: i32,
}

pub async fn update_plan(pool: &PgPool, jar: &Jar, by: Uuid, change: &PlanChange<'_>, notice: &str) -> AppResult<()> {
    if jar.owner_id != by {
        return Err(AppError::NotFound);
    }
    let mut tx = pool.begin().await?;
    sqlx::query(
        "update finansy.jars set goal_amount = $2, target_date = $3, frequency = $4, plan_kind = $5, plan_step_bp = $6
         where id = $1 and owner_id = $7",
    )
    .bind(jar.id)
    .bind(change.goal)
    .bind(change.target_date)
    .bind(change.frequency)
    .bind(change.plan_kind)
    .bind(change.step_bp)
    .bind(by)
    .execute(&mut *tx)
    .await?;
    notify_others(&mut tx, jar.id, by, notice).await?;
    tx.commit().await?;
    Ok(())
}

/// Prioridad personal del jarrón (1 = la más importante); `None` la quita. Solo toca la fila de `user`.
pub async fn set_priority(pool: &PgPool, jar_id: Uuid, user: Uuid, priority: Option<i16>) -> AppResult<()> {
    sqlx::query("update finansy.jar_members set priority = $3 where jar_id = $1 and user_id = $2 and left_at is null")
        .bind(jar_id)
        .bind(user)
        .bind(priority)
        .execute(pool)
        .await?;
    Ok(())
}

/// Guarda la foto (ya recodificada a JPEG). Solo quien creó el jarrón.
pub async fn set_image(pool: &PgPool, jar: &Jar, by: Uuid, data: &[u8]) -> AppResult<()> {
    if jar.owner_id != by {
        return Err(AppError::NotFound);
    }
    let mut tx = pool.begin().await?;
    sqlx::query(
        "insert into finansy.jar_images (jar_id, data) values ($1, $2)
         on conflict (jar_id) do update set data = excluded.data",
    )
    .bind(jar.id)
    .bind(data)
    .execute(&mut *tx)
    .await?;
    sqlx::query("update finansy.jars set image_at = now() where id = $1").bind(jar.id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn clear_image(pool: &PgPool, jar: &Jar, by: Uuid) -> AppResult<()> {
    if jar.owner_id != by {
        return Err(AppError::NotFound);
    }
    let mut tx = pool.begin().await?;
    sqlx::query("delete from finansy.jar_images where jar_id = $1").bind(jar.id).execute(&mut *tx).await?;
    sqlx::query("update finansy.jars set image_at = null where id = $1").bind(jar.id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn get_image(pool: &PgPool, jar_id: Uuid) -> AppResult<Vec<u8>> {
    let row: Option<(Vec<u8>,)> = sqlx::query_as("select data from finansy.jar_images where jar_id = $1").bind(jar_id).fetch_optional(pool).await?;
    row.map(|(data,)| data).ok_or(AppError::NotFound)
}

/// Une a `user` al jarrón grupal del código. Si ya había salido, vuelve a entrar.
pub async fn join(pool: &PgPool, code: &str, user: Uuid, user_name: &str) -> AppResult<Uuid> {
    let jar: Option<(Uuid, String)> =
        sqlx::query_as("select id, name from finansy.jars where invite_code = $1 and kind = 'grupal'")
            .bind(code)
            .fetch_optional(pool)
            .await?;
    let (jar_id, jar_name) = jar.ok_or(AppError::NotFound)?;
    let mut tx = pool.begin().await?;
    let changed = sqlx::query(
        "insert into finansy.jar_members (jar_id, user_id) values ($1, $2)
         on conflict (jar_id, user_id) do update set left_at = null, joined_at = now()
         where finansy.jar_members.left_at is not null",
    )
    .bind(jar_id)
    .bind(user)
    .execute(&mut *tx)
    .await?;
    if changed.rows_affected() > 0 {
        notify_others(&mut tx, jar_id, user, &format!("{user_name} se unió a «{jar_name}»")).await?;
    }
    tx.commit().await?;
    Ok(jar_id)
}

pub async fn leave(pool: &PgPool, jar: &Jar, user: Uuid) -> AppResult<()> {
    if jar.owner_id == user {
        return Err(bad("Quien creó el jarrón no puede salir. Puede borrarlo."));
    }
    sqlx::query("update finansy.jar_members set left_at = now() where jar_id = $1 and user_id = $2 and left_at is null")
        .bind(jar.id)
        .bind(user)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn remove_member(pool: &PgPool, jar: &Jar, by: Uuid, member: Uuid) -> AppResult<()> {
    if jar.owner_id != by {
        return Err(AppError::NotFound);
    }
    if member == by {
        return Err(bad("No puedes sacarte a ti mismo del jarrón que creaste."));
    }
    let mut tx = pool.begin().await?;
    sqlx::query("update finansy.jar_members set left_at = now() where jar_id = $1 and user_id = $2 and left_at is null")
        .bind(jar.id)
        .bind(member)
        .execute(&mut *tx)
        .await?;
    // Con el enlace viejo podría volver a unirse: se cambia el código.
    sqlx::query("update finansy.jars set invite_code = $2 where id = $1 and kind = 'grupal'")
        .bind(jar.id)
        .bind(new_invite_code())
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn regenerate_invite(pool: &PgPool, jar: &Jar, by: Uuid) -> AppResult<()> {
    if jar.owner_id != by || !jar.is_group() {
        return Err(AppError::NotFound);
    }
    sqlx::query("update finansy.jars set invite_code = $2 where id = $1")
        .bind(jar.id)
        .bind(new_invite_code())
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_jar(pool: &PgPool, jar: &Jar, by: Uuid, notice: &str) -> AppResult<()> {
    if jar.owner_id != by {
        return Err(AppError::NotFound);
    }
    let mut tx = pool.begin().await?;
    // Sin jar_id: el aviso tiene que sobrevivir al borrado en cascada.
    sqlx::query(
        "insert into finansy.notifications (user_id, jar_id, body)
         select user_id, null, $3 from finansy.jar_members
         where jar_id = $1 and left_at is null and user_id <> $2",
    )
    .bind(jar.id)
    .bind(by)
    .bind(notice)
    .execute(&mut *tx)
    .await?;
    // Miembros, aportes, retos y avisos del jarrón se borran en cascada.
    sqlx::query("delete from finansy.jars where id = $1 and owner_id = $2").bind(jar.id).bind(by).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn create_challenge(
    pool: &PgPool,
    jar_id: Uuid,
    user: Uuid,
    title: &str,
    amount: i64,
    starts_on: NaiveDate,
    ends_on: NaiveDate,
    notice: &str,
) -> AppResult<()> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "insert into finansy.challenges (jar_id, title, amount_per_member, starts_on, ends_on, created_by)
         values ($1, $2, $3, $4, $5, $6)",
    )
    .bind(jar_id)
    .bind(title)
    .bind(amount)
    .bind(starts_on)
    .bind(ends_on)
    .bind(user)
    .execute(&mut *tx)
    .await?;
    notify_others(&mut tx, jar_id, user, notice).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn challenges(pool: &PgPool, jar_id: Uuid) -> AppResult<Vec<Challenge>> {
    Ok(sqlx::query_as(
        "select title, amount_per_member, starts_on, ends_on from finansy.challenges
         where jar_id = $1 order by ends_on desc, created_at desc",
    )
    .bind(jar_id)
    .fetch_all(pool)
    .await?)
}

/// Días con aportes de una persona en cualquier jarrón (último año y algo): para la racha del encabezado.
pub async fn my_contribution_dates(pool: &PgPool, user: Uuid) -> AppResult<Vec<NaiveDate>> {
    let rows: Vec<(NaiveDate,)> =
        sqlx::query_as("select distinct contributed_on from finansy.contributions where user_id = $1 and contributed_on > current_date - 400")
            .bind(user)
            .fetch_all(pool)
            .await?;
    Ok(rows.into_iter().map(|(d,)| d).collect())
}

pub async fn unread_count(pool: &PgPool, user: Uuid) -> AppResult<i64> {
    let (n,): (i64,) = sqlx::query_as("select count(*) from finansy.notifications where user_id = $1 and read_at is null")
        .bind(user)
        .fetch_one(pool)
        .await?;
    Ok(n)
}

pub async fn notifications(pool: &PgPool, user: Uuid) -> AppResult<Vec<Notification>> {
    Ok(sqlx::query_as(
        "select body, jar_id, read_at, created_at from finansy.notifications
         where user_id = $1 order by created_at desc limit 50",
    )
    .bind(user)
    .fetch_all(pool)
    .await?)
}

pub async fn mark_read(pool: &PgPool, user: Uuid) -> AppResult<()> {
    sqlx::query("update finansy.notifications set read_at = now() where user_id = $1 and read_at is null")
        .bind(user)
        .execute(pool)
        .await?;
    Ok(())
}

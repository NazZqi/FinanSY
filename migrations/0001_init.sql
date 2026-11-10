-- FinanSY v3: jarrones de ahorro.
-- Todo vive en el schema finansy, que la Data API de Supabase no expone.
-- RLS activo y sin políticas: nadie entra por la API pública; la autorización la aplica el servidor Rust.

-- En Supabase el schema ya existe (lo crea el admin, dueño finansy_app). En CI se crea aquí.
-- Con DO se evita el chequeo de permiso CREATE cuando el schema ya existe.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'finansy') then
    create schema finansy;
  end if;
end $$;

create table finansy.profiles (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 80),
  avatar_url text check (char_length(avatar_url) <= 500),
  created_at timestamptz not null default now()
);

create table finansy.jars (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('individual', 'grupal')),
  name text not null check (char_length(name) between 1 and 60),
  category text not null check (category in ('viaje', 'arriendo', 'celular', 'auto', 'otro')),
  goal_amount bigint not null check (goal_amount between 1 and 10000000000),
  target_date date,
  -- Tasa anual de ahorro en puntos básicos: 450 = 4,5 %.
  savings_rate_bp integer not null default 0 check (savings_rate_bp between 0 and 10000),
  invite_code text unique,
  owner_id uuid not null references finansy.profiles (id),
  created_at timestamptz not null default now()
);

create table finansy.jar_members (
  jar_id uuid not null references finansy.jars (id) on delete cascade,
  user_id uuid not null references finansy.profiles (id),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (jar_id, user_id)
);

create table finansy.contributions (
  id uuid primary key default gen_random_uuid(),
  jar_id uuid not null references finansy.jars (id) on delete cascade,
  user_id uuid not null references finansy.profiles (id),
  amount bigint not null check (amount between 1 and 10000000000),
  contributed_on date not null,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now()
);
create index contributions_jar_date on finansy.contributions (jar_id, contributed_on);

create table finansy.challenges (
  id uuid primary key default gen_random_uuid(),
  jar_id uuid not null references finansy.jars (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  amount_per_member bigint not null check (amount_per_member between 1 and 10000000000),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  created_by uuid not null references finansy.profiles (id),
  created_at timestamptz not null default now()
);

create table finansy.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references finansy.profiles (id),
  jar_id uuid references finansy.jars (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread on finansy.notifications (user_id, read_at);

alter table finansy.profiles enable row level security;
alter table finansy.jars enable row level security;
alter table finansy.jar_members enable row level security;
alter table finansy.contributions enable row level security;
alter table finansy.challenges enable row level security;
alter table finansy.notifications enable row level security;

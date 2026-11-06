-- Frecuencia de ahorro, tipo de plan, prioridad personal y foto del jarrón.

alter table finansy.jars
  add column frequency text not null default 'mensual' check (frequency in ('diario', 'semanal', 'mensual')),
  add column plan_kind text not null default 'constante' check (plan_kind in ('constante', 'decreciente', 'creciente', 'libre')),
  -- Cambio de la cuota por período en puntos básicos: 1000 = 10 %.
  add column plan_step_bp integer not null default 0 check (plan_step_bp between 0 and 5000),
  add column image_at timestamptz;

-- Prioridad personal de cada miembro: 1 es la más importante. Sin valor = sin prioridad.
alter table finansy.jar_members add column priority smallint check (priority between 1 and 99);

-- La foto va aparte para que las listas no carguen bytes. Siempre es JPEG ya recodificado.
create table finansy.jar_images (
  jar_id uuid primary key references finansy.jars (id) on delete cascade,
  data bytea not null check (octet_length(data) <= 1048576)
);
alter table finansy.jar_images enable row level security;

-- 0001 · Base: utilidades comunes y auditoría
-- Zona horaria de negocio: America/Bogota (las fechas se guardan en timestamptz/UTC).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Auditoría de operaciones importantes. Solo se escribe vía trigger (security definer).
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- No registrar updates que no cambian nada (salvo updated_at).
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return new;
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

alter table public.audit_logs enable row level security;
-- La política de lectura (audit.read) se define en 0002, cuando existe has_permission().
revoke insert, update, delete on public.audit_logs from anon, authenticated;

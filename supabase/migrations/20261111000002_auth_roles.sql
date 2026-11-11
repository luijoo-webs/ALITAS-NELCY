-- 0002 · Perfiles, roles, permisos configurables y autorización en RLS

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  phone       text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z_]{2,40}$'),
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger roles_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  description text not null
);

create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete restrict,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles (role_id);

-- ── Funciones de autorización (usadas en todas las políticas RLS) ──────────

create or replace function public.is_superadmin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.code = 'superadmin'
  );
$$;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.is_superadmin(auth.uid())
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid() and p.code = p_code
    )
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

-- Lista de permisos del usuario actual (la usa el frontend para mostrar/ocultar;
-- la seguridad real está en RLS y en las funciones).
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.code
  from public.permissions p
  where public.has_permission(p.code);
$$;

-- ── Protecciones de roles ────────────────────────────────────────────────

-- Solo un superadmin puede otorgar o quitar el rol superadmin,
-- y nunca se puede quitar el último superadmin.
create or replace function public.guard_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id uuid := coalesce(new.role_id, old.role_id);
  v_is_super_role boolean;
begin
  select code = 'superadmin' into v_is_super_role from public.roles where id = v_role_id;

  if v_is_super_role then
    -- auth.uid() nulo = SQL editor / service role (bootstrap y soporte).
    if auth.uid() is not null and not public.is_superadmin(auth.uid()) then
      raise exception 'Solo un superadministrador puede gestionar el rol superadmin'
        using errcode = '42501';
    end if;
    if tg_op = 'DELETE' and (
      select count(*) from public.user_roles where role_id = v_role_id
    ) <= 1 then
      raise exception 'No se puede quitar el último superadministrador'
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.granted_by := coalesce(new.granted_by, auth.uid());
    return new;
  end if;
  return old;
end;
$$;

create trigger user_roles_guard
  before insert or delete on public.user_roles
  for each row execute function public.guard_user_roles();

create or replace function public.guard_system_roles()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    if tg_op = 'DELETE' then
      raise exception 'Los roles de sistema no se pueden eliminar' using errcode = 'P0001';
    end if;
    if new.code <> old.code or new.is_system <> old.is_system then
      raise exception 'No se puede cambiar el código de un rol de sistema' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger roles_guard
  before update or delete on public.roles
  for each row execute function public.guard_system_roles();

-- Los permisos del rol superadmin no se editan: tiene acceso total por definición.
create or replace function public.guard_superadmin_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.roles
    where id = coalesce(new.role_id, old.role_id) and code = 'superadmin'
  ) then
    raise exception 'El rol superadmin tiene todos los permisos; no se edita' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger role_permissions_guard
  before insert or delete on public.role_permissions
  for each row execute function public.guard_superadmin_permissions();

-- Primer superadministrador. Ejecutar UNA vez desde el SQL Editor de Supabase:
--   select public.bootstrap_superadmin('correo@dominio.com');
-- No está expuesta a anon/authenticated.
create or replace function public.bootstrap_superadmin(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_role uuid;
begin
  select id into v_role from public.roles where code = 'superadmin';
  if exists (select 1 from public.user_roles where role_id = v_role) then
    raise exception 'Ya existe un superadministrador';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'No existe un usuario con ese correo. Regístralo primero.';
  end if;
  insert into public.user_roles (user_id, role_id) values (v_user, v_role);
end;
$$;
revoke execute on function public.bootstrap_superadmin(text) from public, anon, authenticated;

-- ── Datos base: roles y permisos (configuración del sistema, no datos del negocio) ──

insert into public.roles (code, name, description, is_system) values
  ('superadmin', 'Superadministrador', 'Acceso completo, gestiona usuarios y permisos', true),
  ('admin',      'Administrador',      'Operación comercial completa', true),
  ('inventory',  'Encargado de inventario', 'Ingredientes, recetas, compras, movimientos y mermas', true),
  ('staff',      'Empleado',           'Pedidos, ventas manuales y verificación de pagos', true),
  ('kitchen',    'Cocina',             'Consulta de pedidos y actualización de preparación', true);

insert into public.permissions (code, module, description) values
  ('dashboard.read',        'dashboard',  'Ver el dashboard'),
  ('catalog.manage',        'catalog',    'Crear y editar categorías, productos, opciones y promociones'),
  ('settings.manage',       'settings',   'Editar la configuración del restaurante'),
  ('customers.read',        'customers',  'Ver clientes y sus direcciones'),
  ('customers.manage',      'customers',  'Editar clientes'),
  ('users.manage',          'users',      'Gestionar usuarios del personal, roles y permisos'),
  ('audit.read',            'users',      'Consultar la auditoría'),
  ('orders.read',           'orders',     'Ver pedidos'),
  ('orders.update_status',  'orders',     'Cambiar el estado de los pedidos'),
  ('orders.create_manual',  'orders',     'Registrar ventas manuales (WhatsApp, teléfono, mostrador)'),
  ('orders.cancel',         'orders',     'Cancelar pedidos'),
  ('payments.verify',       'payments',   'Verificar y registrar pagos'),
  ('inventory.read',        'inventory',  'Ver ingredientes, existencias y kardex'),
  ('inventory.manage',      'inventory',  'Crear y editar ingredientes'),
  ('inventory.adjust',      'inventory',  'Ajustes manuales, mermas y conteos'),
  ('recipes.manage',        'inventory',  'Crear y editar recetas'),
  ('purchases.manage',      'purchases',  'Proveedores y órdenes de compra'),
  ('purchases.receive',     'purchases',  'Registrar recepción de mercancía'),
  ('expenses.manage',       'finance',    'Registrar gastos'),
  ('reports.read',          'reports',    'Ver reportes y exportar');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (r.code = 'admin' and p.code not in ('users.manage', 'audit.read'))
  or (r.code = 'inventory' and p.code in (
      'dashboard.read', 'inventory.read', 'inventory.manage', 'inventory.adjust',
      'recipes.manage', 'purchases.manage', 'purchases.receive'))
  or (r.code = 'staff' and p.code in (
      'dashboard.read', 'orders.read', 'orders.update_status', 'orders.create_manual',
      'payments.verify', 'customers.read'))
  or (r.code = 'kitchen' and p.code in ('orders.read', 'orders.update_status'))
);

-- ── Perfil automático al registrarse ─────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9+ ]', '', 'g'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('users.manage') or public.has_permission('customers.read'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));
revoke insert, delete on public.profiles from anon, authenticated;

create policy roles_select on public.roles for select to authenticated
  using (public.is_staff());
create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

create policy permissions_select on public.permissions for select to authenticated
  using (public.is_staff());
revoke insert, update, delete on public.permissions from anon, authenticated;

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (public.is_staff());
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.manage'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (public.has_permission('users.manage'));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (public.has_permission('users.manage'));
revoke update on public.user_roles from anon, authenticated;

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_permission('audit.read'));

-- Auditoría de cambios de permisos
create trigger roles_audit after insert or update or delete on public.roles
  for each row execute function public.audit_row();
create trigger role_permissions_audit after insert or delete on public.role_permissions
  for each row execute function public.audit_row();
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_row();

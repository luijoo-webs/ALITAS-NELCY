-- 0003 · Configuración del restaurante, horarios, zonas de domicilio y métodos de pago

-- Configuración pública (la lee el sitio). Fila única.
create table public.restaurant_settings (
  id                 boolean primary key default true check (id),
  name               text not null,
  tagline            text,
  phone              text,
  whatsapp           text check (whatsapp ~ '^[0-9]{10,15}$'),  -- formato wa.me: solo dígitos con indicativo
  public_email       text,
  address            text,
  neighborhood       text,
  city               text,
  maps_url           text,
  instagram_url      text,
  facebook_url       text,
  tiktok_url         text,
  logo_path          text,
  policies           jsonb not null default '{}'::jsonb,   -- { "domicilios": "...", "privacidad": "...", ... }
  orders_paused      boolean not null default false,
  paused_message     text,
  prep_time_minutes  integer check (prep_time_minutes between 1 and 240),
  updated_at         timestamptz not null default now()
);
create trigger restaurant_settings_updated_at before update on public.restaurant_settings
  for each row execute function public.set_updated_at();

-- Configuración interna (solo personal autorizado).
create table public.restaurant_private_settings (
  id                      boolean primary key default true check (id),
  auto_confirm_orders     boolean not null default false,
  sender_email            text,
  notification_emails     text[] not null default '{}',
  inventory_auto_disable  boolean not null default false,
  allow_negative_stock    boolean not null default true,
  expiry_warning_days     integer not null default 3 check (expiry_warning_days between 0 and 60),
  updated_at              timestamptz not null default now()
);
create trigger restaurant_private_settings_updated_at before update on public.restaurant_private_settings
  for each row execute function public.set_updated_at();

-- Datos confirmados en web, Instagram y Google (§1.1 del análisis).
-- El horario NO se carga: hay contradicción entre fuentes y debe confirmarlo el restaurante.
insert into public.restaurant_settings (name, phone, whatsapp, address, neighborhood, city, instagram_url)
values (
  'Alitas Nelcy',
  '+57 321 891 8754',
  '573218918754',
  'Transversal 26 # 18D-02',
  'Los Fundadores',
  'Valledupar, Cesar',
  'https://www.instagram.com/alitasnelcyvalledupar/'
);
insert into public.restaurant_private_settings default values;

-- Horario semanal. weekday: 0 = domingo … 6 = sábado (igual que extract(dow)).
create table public.business_hours (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6),
  opens_at   time not null,
  closes_at  time not null,
  -- shortcut: no admite franjas que crucen medianoche; si abren después de las 00:00, partir en dos franjas.
  check (closes_at > opens_at)
);
create index business_hours_weekday_idx on public.business_hours (weekday);

create table public.business_closures (
  id          uuid primary key default gen_random_uuid(),
  closed_on   date not null unique,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ¿Se pueden recibir pedidos ahora? (hora de Bogotá)
create or replace function public.is_open_now(p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with local as (select (p_at at time zone 'America/Bogota') as ts)
  select
    not coalesce((select orders_paused from public.restaurant_settings), true)
    and not exists (
      select 1 from public.business_closures, local where closed_on = local.ts::date
    )
    and exists (
      select 1 from public.business_hours h, local
      where h.weekday = extract(dow from local.ts)
        and local.ts::time >= h.opens_at
        and local.ts::time <  h.closes_at
    );
$$;

-- Zonas de domicilio por barrios.
create table public.delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  fee          numeric(12,2) not null check (fee >= 0),
  min_order    numeric(12,2) not null default 0 check (min_order >= 0),
  free_from    numeric(12,2) check (free_from > 0),
  eta_minutes  integer check (eta_minutes between 5 and 240),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

create table public.delivery_zone_neighborhoods (
  id            uuid primary key default gen_random_uuid(),
  zone_id       uuid not null references public.delivery_zones (id) on delete cascade,
  neighborhood  text not null check (char_length(trim(neighborhood)) between 2 and 80)
);
-- Un barrio pertenece a una sola zona.
create unique index delivery_zone_neighborhoods_unique on public.delivery_zone_neighborhoods (lower(trim(neighborhood)));
create index delivery_zone_neighborhoods_zone_idx on public.delivery_zone_neighborhoods (zone_id);

create or replace function public.zone_for_neighborhood(p_neighborhood text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select z.id
  from public.delivery_zone_neighborhoods n
  join public.delivery_zones z on z.id = n.zone_id
  where lower(trim(n.neighborhood)) = lower(trim(p_neighborhood))
    and z.is_active;
$$;

-- Métodos de pago configurables. Se crean INACTIVOS y sin instrucciones:
-- el restaurante activa los que acepta y escribe sus datos (número, llave Bre-B, etc.).
create table public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z_]{2,40}$'),
  label           text not null,
  instructions    text,
  requires_proof  boolean not null default false,
  available_for   text not null default 'both' check (available_for in ('delivery', 'pickup', 'both')),
  is_online       boolean not null default false,
  is_active       boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Ninguna pasarela está integrada todavía (§7.3 del análisis).
  check (not (is_online and is_active))
);
create trigger payment_methods_updated_at before update on public.payment_methods
  for each row execute function public.set_updated_at();

insert into public.payment_methods (code, label, requires_proof, sort_order) values
  ('cash',             'Efectivo',                   false, 1),
  ('card_on_delivery', 'Datáfono contra entrega',    false, 2),
  ('nequi',            'Nequi',                      true,  3),
  ('daviplata',        'Daviplata',                  true,  4),
  ('breb',             'Bre-B (llave o QR)',         true,  5),
  ('transfer',         'Transferencia bancaria',     true,  6);

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.restaurant_settings enable row level security;
alter table public.restaurant_private_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_closures enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.delivery_zone_neighborhoods enable row level security;
alter table public.payment_methods enable row level security;

create policy restaurant_settings_read on public.restaurant_settings for select to anon, authenticated using (true);
create policy restaurant_settings_update on public.restaurant_settings for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
revoke insert, delete on public.restaurant_settings from anon, authenticated;

create policy restaurant_private_settings_read on public.restaurant_private_settings for select to authenticated
  using (public.has_permission('settings.manage'));
create policy restaurant_private_settings_update on public.restaurant_private_settings for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
revoke insert, delete on public.restaurant_private_settings from anon, authenticated;

create policy business_hours_read on public.business_hours for select to anon, authenticated using (true);
create policy business_hours_write on public.business_hours for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy business_closures_read on public.business_closures for select to anon, authenticated using (true);
create policy business_closures_write on public.business_closures for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy delivery_zones_read on public.delivery_zones for select to anon, authenticated
  using (is_active or public.has_permission('settings.manage'));
create policy delivery_zones_write on public.delivery_zones for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy delivery_zone_neighborhoods_read on public.delivery_zone_neighborhoods for select to anon, authenticated
  using (true);
create policy delivery_zone_neighborhoods_write on public.delivery_zone_neighborhoods for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy payment_methods_read on public.payment_methods for select to anon, authenticated
  using (is_active or public.has_permission('settings.manage'));
create policy payment_methods_write on public.payment_methods for all to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create trigger restaurant_settings_audit after update on public.restaurant_settings
  for each row execute function public.audit_row();
create trigger restaurant_private_settings_audit after update on public.restaurant_private_settings
  for each row execute function public.audit_row();
create trigger delivery_zones_audit after insert or update or delete on public.delivery_zones
  for each row execute function public.audit_row();
create trigger payment_methods_audit after insert or update or delete on public.payment_methods
  for each row execute function public.audit_row();

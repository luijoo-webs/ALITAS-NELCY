-- 0007 · Pedidos, pagos y resumen del dashboard
--
-- Las tablas quedan listas para que el dashboard muestre datos reales desde el primer pedido.
-- Nadie escribe pedidos directamente: en la Fase 5 se crean y avanzan solo con funciones
-- security definer (create_order, confirm_order, set_order_status), que validan precios,
-- horario, zona, transiciones e inventario. Por eso aquí no hay políticas de insert/update.

create table public.order_statuses (
  code             text primary key check (code ~ '^[a-z_]{2,40}$'),
  label            text not null,
  kind             text not null check (kind in ('new','confirmed','in_progress','ready','out_for_delivery','delivered','cancelled')),
  sort_order       int  not null default 0,
  notify_customer  boolean not null default true,
  is_active        boolean not null default true
);

insert into public.order_statuses (code, label, kind, sort_order, notify_customer) values
  ('new',              'Nuevo',               'new',              10, true),
  ('confirmed',        'Confirmado',          'confirmed',        20, true),
  ('preparing',        'En preparación',      'in_progress',      30, false),
  ('ready',            'Listo',               'ready',            40, false),
  ('ready_for_pickup', 'Listo para recoger',  'ready',            45, true),
  ('out_for_delivery', 'En camino',           'out_for_delivery', 50, true),
  ('delivered',        'Entregado',           'delivered',        60, true),
  ('cancelled',        'Cancelado',           'cancelled',        90, true);

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  number             bigint generated always as identity (start with 1001) unique,
  public_token       uuid not null default gen_random_uuid() unique,
  idempotency_key    text unique check (char_length(idempotency_key) between 8 and 80),
  customer_id        uuid references public.customers (id) on delete set null,
  channel            text not null check (channel in ('web','counter','phone','whatsapp')),
  fulfillment        text not null check (fulfillment in ('delivery','pickup','dine_in')),
  status             text not null default 'new' references public.order_statuses (code),
  -- Copia de la dirección al momento del pedido (cambiarla luego no altera el pedido)
  customer_name      text check (char_length(customer_name) <= 120),
  customer_phone     text check (customer_phone ~ '^\+?[0-9 ]{7,20}$'),
  customer_email     text check (customer_email = lower(customer_email)),
  address            text check (char_length(address) <= 200),
  neighborhood       text check (char_length(neighborhood) <= 80),
  address_reference  text check (char_length(address_reference) <= 200),
  delivery_zone_id   uuid references public.delivery_zones (id) on delete set null,
  subtotal           numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee       numeric(12,2) not null default 0 check (delivery_fee >= 0),
  discount           numeric(12,2) not null default 0 check (discount >= 0),
  total              numeric(12,2) not null default 0 check (total >= 0),
  payment_method_id  uuid references public.payment_methods (id) on delete restrict,
  payment_status     text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  cash_change_for    numeric(12,2) check (cash_change_for >= 0),
  notes              text check (char_length(notes) <= 500),
  scheduled_for      timestamptz,
  inventory_state    text not null default 'none' check (inventory_state in ('none','consumed','reversed')),
  created_by         uuid references auth.users (id) on delete set null,
  confirmed_at       timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text check (char_length(cancel_reason) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (total = subtotal + delivery_fee - discount),
  check (fulfillment <> 'delivery' or address is not null)
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_customer_idx on public.orders (customer_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  name_snapshot text not null,
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  quantity      int not null check (quantity between 1 and 99),
  line_total    numeric(12,2) not null check (line_total >= 0),
  notes         text check (char_length(notes) <= 200)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_item_modifiers (
  id                 uuid primary key default gen_random_uuid(),
  order_item_id      uuid not null references public.order_items (id) on delete cascade,
  modifier_option_id uuid references public.modifier_options (id) on delete set null,
  name_snapshot      text not null,
  price_delta        numeric(12,2) not null default 0
);
create index order_item_modifiers_item_idx on public.order_item_modifiers (order_item_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text references public.order_statuses (code),
  to_status   text not null references public.order_statuses (code),
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id);

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  payment_method_id uuid references public.payment_methods (id) on delete restrict,
  amount            numeric(12,2) not null check (amount > 0),
  status            text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  reference         text check (char_length(reference) <= 120),
  proof_path        text,
  provider          text,
  provider_tx_id    text unique,
  registered_by     uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ── RLS: lectura para personal con orders.read y para el dueño del pedido ──

alter table public.order_statuses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;

create policy order_statuses_read on public.order_statuses for select using (true);
create policy order_statuses_manage on public.order_statuses for all
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy orders_read on public.orders for select
  using (public.has_permission('orders.read') or (customer_id is not null and customer_id = public.my_customer_id()));

create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id));  -- hereda la RLS de orders
create policy order_item_modifiers_read on public.order_item_modifiers for select
  using (exists (select 1 from public.order_items i where i.id = order_item_id));
create policy order_status_history_read on public.order_status_history for select
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy payments_read on public.payments for select
  using (public.has_permission('orders.read') or public.has_permission('payments.verify')
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.my_customer_id()));

-- Sin políticas de escritura: solo las funciones de la Fase 5 (security definer) escriben.
revoke insert, update, delete on public.orders, public.order_items, public.order_item_modifiers,
  public.order_status_history, public.payments from anon, authenticated;

create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function public.audit_row();
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function public.audit_row();
create trigger order_statuses_audit after insert or update or delete on public.order_statuses
  for each row execute function public.audit_row();

alter publication supabase_realtime add table public.orders;

-- ── Resumen del dashboard ────────────────────────────────────────────────
-- Ventas = pedidos entregados (§11). Fechas agrupadas en hora de Bogotá.

create or replace function public.dashboard_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.has_permission('dashboard.read') then
    raise exception 'Sin permiso para ver el dashboard' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '366 days' then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;

  with o as (
    select o.*, s.kind
    from public.orders o
    join public.order_statuses s on s.code = o.status
    where o.created_at >= p_from and o.created_at < p_to
  ),
  delivered as (select * from o where kind = 'delivered')
  select jsonb_build_object(
    'sales',           coalesce((select sum(total) from delivered), 0),
    'delivered_count', (select count(*) from delivered),
    'orders_count',    (select count(*) from o where kind <> 'cancelled'),
    'cancelled_count', (select count(*) from o where kind = 'cancelled'),
    'avg_ticket',      coalesce((select round(avg(total), 0) from delivered), 0),
    'new_customers',   (select count(*) from public.customers c where c.created_at >= p_from and c.created_at < p_to),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'sales', sales, 'orders', n) order by d)
      from (
        select (created_at at time zone 'America/Bogota')::date as d, sum(total) as sales, count(*) as n
        from delivered group by 1
      ) x), '[]'::jsonb),
    'by_channel', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'sales', sales, 'orders', n) order by sales desc)
      from (select channel, sum(total) as sales, count(*) as n from delivered group by channel) x), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'quantity', qty, 'sales', sales) order by qty desc, sales desc)
      from (
        select i.name_snapshot as name, sum(i.quantity) as qty, sum(i.line_total) as sales
        from public.order_items i join delivered d on d.id = i.order_id
        group by i.name_snapshot order by qty desc, sales desc limit 5
      ) x), '[]'::jsonb),
    -- Pedidos abiertos ahora mismo (sin importar el rango): lo que la cocina tiene encima
    'open_by_status', coalesce((
      select jsonb_agg(jsonb_build_object('code', s.code, 'label', s.label, 'count', n) order by s.sort_order)
      from (
        select status, count(*) as n from public.orders o2
        join public.order_statuses s2 on s2.code = o2.status
        where s2.kind not in ('delivered','cancelled') group by status
      ) x join public.order_statuses s on s.code = x.status), '[]'::jsonb),
    'catalog', jsonb_build_object(
      'products',    (select count(*) from public.products where not is_archived),
      'unavailable', (select count(*) from public.products where not is_archived and not is_available)
    )
  ) into v;

  return v;
end;
$$;

revoke execute on function public.dashboard_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_summary(timestamptz, timestamptz) to authenticated;

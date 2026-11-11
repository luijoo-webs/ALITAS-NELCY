-- 0008 · Inventario por ingredientes: insumos, recetas, proveedores, compras, kardex y alertas
--
-- Todo se guarda en unidad base (g, ml, unit). Las compras aceptan kg y l y se convierten aquí.
-- El navegador no escribe estas tablas: solo las funciones de abajo (security definer).
-- shortcut: sin órdenes de compra en borrador, lotes ni vencimientos (compras de contado
-- recibidas al registrar); el conteo físico se hace con adjust_stock tipo 'count'.
-- Agregar purchase_orders/lotes si el restaurante empieza a comprar a crédito o maneja perecederos por lote.

create table public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(trim(name)) between 2 and 120),
  nit         text check (char_length(nit) <= 30),
  contact     text check (char_length(contact) <= 120),
  phone       text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  notes       text check (char_length(notes) <= 500),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.ingredients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique check (char_length(trim(name)) between 2 and 80),
  category          text check (char_length(category) <= 60),
  base_unit         text not null check (base_unit in ('g', 'ml', 'unit')),
  stock_qty         numeric(14,3) not null default 0,
  min_stock         numeric(14,3) not null default 0 check (min_stock >= 0),
  avg_cost          numeric(14,4) not null default 0 check (avg_cost >= 0),  -- por unidad base
  main_supplier_id  uuid references public.suppliers (id) on delete set null,
  is_critical       boolean not null default false,  -- en 0 apaga los productos auto_by_stock que lo usan
  is_active         boolean not null default true,
  last_purchase_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger ingredients_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();

-- Receta: cantidad en unidad base por 1 unidad vendida de un producto, variante u opción.
-- Si una variante tiene receta propia, reemplaza la del producto.
create table public.recipe_items (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid references public.products (id) on delete cascade,
  variant_id          uuid references public.product_variants (id) on delete cascade,
  modifier_option_id  uuid references public.modifier_options (id) on delete cascade,
  ingredient_id       uuid not null references public.ingredients (id) on delete restrict,
  quantity            numeric(14,3) not null check (quantity > 0),
  waste_pct           numeric(5,2) not null default 0 check (waste_pct between 0 and 100),
  created_at          timestamptz not null default now(),
  check (num_nonnulls(product_id, variant_id, modifier_option_id) = 1)
);
create unique index recipe_items_unique on public.recipe_items
  (coalesce(product_id, variant_id, modifier_option_id), ingredient_id);
create index recipe_items_ingredient_idx on public.recipe_items (ingredient_id);

create table public.purchases (
  id            uuid primary key default gen_random_uuid(),
  number        bigint generated always as identity (start with 1) unique,
  supplier_id   uuid references public.suppliers (id) on delete set null,
  invoice_ref   text check (char_length(invoice_ref) <= 60),
  purchased_at  timestamptz not null default now(),
  total         numeric(14,2) not null default 0 check (total >= 0),
  notes         text check (char_length(notes) <= 500),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.purchase_items (
  id             uuid primary key default gen_random_uuid(),
  purchase_id    uuid not null references public.purchases (id) on delete cascade,
  ingredient_id  uuid not null references public.ingredients (id) on delete restrict,
  quantity       numeric(14,3) not null check (quantity > 0),   -- en la unidad comprada
  unit           text not null,
  qty_base       numeric(14,3) not null check (qty_base > 0),
  line_total     numeric(14,2) not null check (line_total >= 0),
  unit_cost_base numeric(14,4) not null check (unit_cost_base >= 0)
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

-- Kardex: solo inserción
create table public.inventory_movements (
  id              bigint generated always as identity primary key,
  ingredient_id   uuid not null references public.ingredients (id) on delete restrict,
  type            text not null check (type in ('purchase', 'sale_consumption', 'sale_reversal', 'adjustment_in', 'adjustment_out', 'waste', 'count')),
  qty_base        numeric(14,3) not null,  -- con signo
  balance_before  numeric(14,3) not null,
  balance_after   numeric(14,3) not null,
  unit_cost       numeric(14,4) not null default 0,
  order_id        uuid references public.orders (id) on delete set null,
  purchase_id     uuid references public.purchases (id) on delete set null,
  reason          text check (char_length(reason) <= 300),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index inventory_movements_ingredient_idx on public.inventory_movements (ingredient_id, created_at desc);
create index inventory_movements_created_idx on public.inventory_movements (created_at desc);
-- Segunda barrera contra el doble descuento de un mismo pedido
create unique index inventory_movements_order_once on public.inventory_movements (order_id, ingredient_id, type)
  where order_id is not null;

create table public.inventory_alerts (
  id             uuid primary key default gen_random_uuid(),
  ingredient_id  uuid not null references public.ingredients (id) on delete cascade,
  type           text not null check (type in ('low_stock', 'out_of_stock', 'negative_stock')),
  status         text not null default 'open' check (status in ('open', 'resolved')),
  message        text not null,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create unique index inventory_alerts_one_open on public.inventory_alerts (ingredient_id, type) where status = 'open';

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.suppliers enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_alerts enable row level security;

create policy suppliers_read on public.suppliers for select to authenticated
  using (public.has_permission('inventory.read') or public.has_permission('purchases.manage'));
create policy suppliers_write on public.suppliers for all to authenticated
  using (public.has_permission('purchases.manage')) with check (public.has_permission('purchases.manage'));

create policy ingredients_read on public.ingredients for select to authenticated
  using (public.has_permission('inventory.read'));
-- Datos maestros editables; el stock y el costo NO (columna excluida del grant de abajo).
create policy ingredients_insert on public.ingredients for insert to authenticated
  with check (public.has_permission('inventory.manage'));
create policy ingredients_update on public.ingredients for update to authenticated
  using (public.has_permission('inventory.manage')) with check (public.has_permission('inventory.manage'));

create policy recipe_items_read on public.recipe_items for select to authenticated
  using (public.has_permission('inventory.read') or public.has_permission('recipes.manage'));
create policy recipe_items_write on public.recipe_items for all to authenticated
  using (public.has_permission('recipes.manage')) with check (public.has_permission('recipes.manage'));

create policy purchases_read on public.purchases for select to authenticated
  using (public.has_permission('purchases.manage') or public.has_permission('inventory.read'));
create policy purchase_items_read on public.purchase_items for select to authenticated
  using (exists (select 1 from public.purchases p where p.id = purchase_id));
create policy inventory_movements_read on public.inventory_movements for select to authenticated
  using (public.has_permission('inventory.read'));
create policy inventory_alerts_read on public.inventory_alerts for select to authenticated
  using (public.has_permission('inventory.read'));

revoke insert, update, delete on public.purchases, public.purchase_items, public.inventory_movements,
  public.inventory_alerts from anon, authenticated;
revoke insert, update, delete on public.ingredients from anon, authenticated;
grant insert (name, category, base_unit, min_stock, main_supplier_id, is_critical, is_active) on public.ingredients to authenticated;
grant update (name, category, min_stock, main_supplier_id, is_critical, is_active) on public.ingredients to authenticated;

create trigger ingredients_audit after insert or update or delete on public.ingredients
  for each row execute function public.audit_row();
create trigger recipe_items_audit after insert or update or delete on public.recipe_items
  for each row execute function public.audit_row();
create trigger suppliers_audit after insert or update or delete on public.suppliers
  for each row execute function public.audit_row();

alter publication supabase_realtime add table public.inventory_alerts;

-- ── Funciones internas ───────────────────────────────────────────────────

-- Convierte a unidad base. Mezclar masa y volumen es error.
create or replace function public.to_base_qty(p_qty numeric, p_unit text, p_base text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case
    when p_unit = p_base then p_qty
    when p_base = 'g'  and p_unit = 'kg' then p_qty * 1000
    when p_base = 'ml' and p_unit = 'l'  then p_qty * 1000
    else null
  end;
end;
$$;

-- Escribe un movimiento sobre una fila ya bloqueada y abre/cierra alertas.
create or replace function public.apply_movement(
  p_ingredient uuid, p_type text, p_qty numeric, p_unit_cost numeric,
  p_order uuid default null, p_purchase uuid default null, p_reason text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.ingredients;
  v_after numeric;
begin
  select * into i from public.ingredients where id = p_ingredient for update;
  v_after := i.stock_qty + p_qty;

  insert into public.inventory_movements (ingredient_id, type, qty_base, balance_before, balance_after, unit_cost, order_id, purchase_id, reason, created_by)
  values (p_ingredient, p_type, p_qty, i.stock_qty, v_after, coalesce(p_unit_cost, i.avg_cost), p_order, p_purchase, p_reason, auth.uid());

  update public.ingredients set stock_qty = v_after where id = p_ingredient;

  -- Alertas: una abierta por tipo; se resuelven solas cuando el stock se recupera
  update public.inventory_alerts set status = 'resolved', resolved_at = now()
  where ingredient_id = p_ingredient and status = 'open'
    and ((type = 'negative_stock' and v_after >= 0)
      or (type = 'out_of_stock' and v_after > 0)
      or (type = 'low_stock' and v_after > i.min_stock));

  if v_after < 0 then
    insert into public.inventory_alerts (ingredient_id, type, message)
    values (p_ingredient, 'negative_stock', format('%s quedó en negativo (%s %s). Haz un conteo.', i.name, v_after, i.base_unit))
    on conflict do nothing;
  elsif v_after = 0 then
    insert into public.inventory_alerts (ingredient_id, type, message)
    values (p_ingredient, 'out_of_stock', format('%s está agotado.', i.name))
    on conflict do nothing;
  elsif v_after <= i.min_stock then
    insert into public.inventory_alerts (ingredient_id, type, message)
    values (p_ingredient, 'low_stock', format('%s está bajo el mínimo (%s de %s %s).', i.name, v_after, i.min_stock, i.base_unit))
    on conflict do nothing;
  end if;
end;
$$;

-- Productos en modo auto_by_stock: no disponibles si algún insumo crítico de su receta está en 0 o menos.
create or replace function public.refresh_auto_availability(p_ingredients uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
  set is_available = not exists (
    select 1
    from public.recipe_items r
    join public.ingredients i on i.id = r.ingredient_id
    where i.is_critical and i.stock_qty <= 0
      and (r.product_id = p.id or r.variant_id in (select v.id from public.product_variants v where v.product_id = p.id))
  )
  where p.availability_mode = 'auto_by_stock'
    and p.id in (
      select coalesce(r.product_id, v.product_id)
      from public.recipe_items r
      left join public.product_variants v on v.id = r.variant_id
      where r.ingredient_id = any (p_ingredients)
    );
$$;

-- Lo que consume un pedido, por ingrediente (receta de variante > receta de producto, + opciones).
create or replace function public.order_requirements(p_order uuid)
returns table (ingredient_id uuid, qty numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select oi.id, oi.product_id, oi.variant_id, oi.quantity from public.order_items oi where oi.order_id = p_order
  ),
  needs as (
    select r.ingredient_id, r.quantity * (1 + r.waste_pct / 100) * l.quantity as q
    from lines l
    join public.recipe_items r on
      (l.variant_id is not null and r.variant_id = l.variant_id)
      or (r.product_id = l.product_id and not exists (
            select 1 from public.recipe_items rv where l.variant_id is not null and rv.variant_id = l.variant_id))
    union all
    select r.ingredient_id, r.quantity * (1 + r.waste_pct / 100) * l.quantity
    from lines l
    join public.order_item_modifiers m on m.order_item_id = l.id
    join public.recipe_items r on r.modifier_option_id = m.modifier_option_id
  )
  select ingredient_id, round(sum(q), 3) from needs group by ingredient_id;
$$;

-- Descuenta el inventario de un pedido. Idempotente; bloquea ingredientes en orden por id.
create or replace function public.consume_order_inventory(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_state text;
  v_ids uuid[] := '{}';
begin
  select inventory_state into v_state from public.orders where id = p_order for update;
  if v_state <> 'none' then return; end if;

  for r in select q.ingredient_id, q.qty from public.order_requirements(p_order) q order by q.ingredient_id loop
    perform public.apply_movement(r.ingredient_id, 'sale_consumption', -r.qty, null, p_order, null, null);
    v_ids := v_ids || r.ingredient_id;
  end loop;

  update public.orders set inventory_state = 'consumed' where id = p_order;
  perform public.refresh_auto_availability(v_ids);
end;
$$;

-- Reintegra lo consumido (pedido cancelado que no se preparó). Idempotente.
create or replace function public.reverse_order_inventory(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_state text;
  v_ids uuid[] := '{}';
begin
  select inventory_state into v_state from public.orders where id = p_order for update;
  if v_state <> 'consumed' then return; end if;

  for r in
    select m.ingredient_id, -sum(m.qty_base) as qty, max(m.unit_cost) as cost
    from public.inventory_movements m
    where m.order_id = p_order and m.type = 'sale_consumption'
    group by m.ingredient_id order by m.ingredient_id
  loop
    perform public.apply_movement(r.ingredient_id, 'sale_reversal', r.qty, r.cost, p_order, null, 'Pedido cancelado: reintegro');
    v_ids := v_ids || r.ingredient_id;
  end loop;

  update public.orders set inventory_state = 'reversed' where id = p_order;
  perform public.refresh_auto_availability(v_ids);
end;
$$;

revoke execute on function public.apply_movement(uuid, text, numeric, numeric, uuid, uuid, text),
  public.refresh_auto_availability(uuid[]), public.order_requirements(uuid),
  public.consume_order_inventory(uuid), public.reverse_order_inventory(uuid)
  from public, anon, authenticated;

-- ── Funciones públicas (con permiso) ─────────────────────────────────────

-- p_items: [{ "ingredient_id": uuid, "quantity": 2, "unit": "kg", "line_total": 24000 }]
create or replace function public.register_purchase(p_supplier uuid, p_invoice text, p_items jsonb, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase uuid;
  it record;
  i public.ingredients;
  v_base numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_ids uuid[] := '{}';
begin
  if not public.has_permission('purchases.manage') then
    raise exception 'Sin permiso para registrar compras' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'La compra debe tener entre 1 y 100 ítems' using errcode = '22023';
  end if;

  insert into public.purchases (supplier_id, invoice_ref, notes, created_by)
  values (p_supplier, nullif(trim(p_invoice), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_purchase;

  for it in
    select (x->>'ingredient_id')::uuid as ingredient_id, (x->>'quantity')::numeric as quantity,
           coalesce(x->>'unit', '') as unit, (x->>'line_total')::numeric as line_total
    from jsonb_array_elements(p_items) x
    order by (x->>'ingredient_id')::uuid
  loop
    select * into i from public.ingredients where id = it.ingredient_id for update;
    if not found then raise exception 'Ingrediente no encontrado' using errcode = '22023'; end if;
    if it.quantity is null or it.quantity <= 0 or it.line_total is null or it.line_total < 0 then
      raise exception 'Cantidad o valor inválido para %', i.name using errcode = '22023';
    end if;
    v_base := public.to_base_qty(it.quantity, it.unit, i.base_unit);
    if v_base is null then
      raise exception 'Unidad % no compatible con % (%).', it.unit, i.name, i.base_unit using errcode = '22023';
    end if;
    v_cost := it.line_total / v_base;

    insert into public.purchase_items (purchase_id, ingredient_id, quantity, unit, qty_base, line_total, unit_cost_base)
    values (v_purchase, i.id, it.quantity, it.unit, v_base, it.line_total, v_cost);

    -- Costo promedio ponderado (si el stock es negativo o cero, el nuevo costo manda)
    update public.ingredients set
      avg_cost = case when i.stock_qty <= 0 then v_cost
                      else round((i.stock_qty * i.avg_cost + v_base * v_cost) / (i.stock_qty + v_base), 4) end,
      last_purchase_at = now(),
      main_supplier_id = coalesce(main_supplier_id, p_supplier)
    where id = i.id;

    perform public.apply_movement(i.id, 'purchase', v_base, v_cost, null, v_purchase, nullif(trim(p_invoice), ''));
    v_total := v_total + it.line_total;
    v_ids := v_ids || i.id;
  end loop;

  update public.purchases set total = v_total where id = v_purchase;
  perform public.refresh_auto_availability(v_ids);
  return v_purchase;
end;
$$;

-- p_type: 'adjustment_in' | 'adjustment_out' | 'waste' (p_qty positivo) o 'count' (p_qty = cantidad contada)
create or replace function public.adjust_stock(p_ingredient uuid, p_type text, p_qty numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock numeric;
  v_delta numeric;
begin
  if not public.has_permission('inventory.adjust') then
    raise exception 'Sin permiso para ajustar inventario' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'El motivo es obligatorio' using errcode = '22023';
  end if;
  if p_qty is null or p_qty < 0 or (p_type <> 'count' and p_qty = 0) then
    raise exception 'Cantidad inválida' using errcode = '22023';
  end if;

  select stock_qty into v_stock from public.ingredients where id = p_ingredient for update;
  if not found then raise exception 'Ingrediente no encontrado' using errcode = '22023'; end if;

  v_delta := case p_type
    when 'adjustment_in' then p_qty
    when 'adjustment_out' then -p_qty
    when 'waste' then -p_qty
    when 'count' then p_qty - v_stock
    else null end;
  if v_delta is null then raise exception 'Tipo de ajuste inválido' using errcode = '22023'; end if;
  if v_delta = 0 then return; end if;

  perform public.apply_movement(p_ingredient, p_type, v_delta, null, null, null, trim(p_reason));
  perform public.refresh_auto_availability(array[p_ingredient]);
end;
$$;

-- Costo estimado de una unidad de cada producto/variante según su receta (para márgenes).
create or replace function public.recipe_costs()
returns table (product_id uuid, variant_id uuid, cost numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, v.id,
    round(coalesce((
      select sum(r.quantity * (1 + r.waste_pct / 100) * i.avg_cost)
      from public.recipe_items r join public.ingredients i on i.id = r.ingredient_id
      where (v.id is not null and r.variant_id = v.id)
         or (r.product_id = p.id and not exists (select 1 from public.recipe_items rv where v.id is not null and rv.variant_id = v.id))
    ), 0), 2)
  from public.products p
  left join public.product_variants v on v.product_id = p.id
  where public.has_permission('recipes.manage') or public.has_permission('inventory.read');
$$;

revoke execute on function public.register_purchase(uuid, text, jsonb, text), public.adjust_stock(uuid, text, numeric, text),
  public.recipe_costs() from public, anon;
grant execute on function public.register_purchase(uuid, text, jsonb, text), public.adjust_stock(uuid, text, numeric, text),
  public.recipe_costs() to authenticated;

-- ── Primer superadmin sin tocar SQL ──────────────────────────────────────
-- Si no existe ningún superadmin, el primer correo de esta lista que confirme su cuenta lo recibe.
-- La lista se llena desde el SQL Editor (no en el repositorio).
create table public.bootstrap_emails (email text primary key check (email = lower(email)));
alter table public.bootstrap_emails enable row level security;  -- sin políticas: invisible desde la API
revoke all on public.bootstrap_emails from anon, authenticated;

create or replace function public.bootstrap_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.bootstrap_emails where email = lower(new.email))
     and not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where r.code = 'superadmin')
  then
    insert into public.user_roles (user_id, role_id)
    select new.id, id from public.roles where code = 'superadmin';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_bootstrap
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.bootstrap_on_confirm();

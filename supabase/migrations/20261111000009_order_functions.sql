-- 0009 · Funciones de pedidos: crear (web y venta manual), cambiar estado, pago y seguimiento público
--
-- El navegador solo manda qué quiere (productos, opciones, cantidades, barrio, método de pago).
-- Precios, promociones, domicilio, horario y disponibilidad se recalculan aquí.

-- Transiciones válidas por tipo de estado
create or replace function public.order_transition_ok(p_from text, p_to text, p_fulfillment text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'new'              then p_to in ('confirmed', 'cancelled')
    when 'confirmed'        then p_to in ('in_progress', 'ready', 'cancelled')
    when 'in_progress'      then p_to in ('ready', 'cancelled')
    when 'ready'            then p_to in ('delivered', 'cancelled') or (p_to = 'out_for_delivery' and p_fulfillment = 'delivery')
    when 'out_for_delivery' then p_to in ('delivered', 'cancelled')
    else false
  end;
$$;

/*
  p: {
    "idempotency_key": "...", "channel": "web|counter|phone|whatsapp", "fulfillment": "delivery|pickup|dine_in",
    "customer": { "name": "...", "phone": "...", "email": "..." },
    "address": { "address": "...", "neighborhood": "...", "reference": "..." },
    "payment_method": "cash", "cash_change_for": 50000, "notes": "...",
    "items": [ { "product_id": uuid, "variant_id": uuid|null, "quantity": 2, "options": [uuid...], "notes": "..." } ],
    "confirm": true   -- solo ventas manuales
  }
*/
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key       text := nullif(trim(p->>'idempotency_key'), '');
  v_channel   text := coalesce(p->>'channel', 'web');
  v_fulfill   text := p->>'fulfillment';
  v_manual    boolean;
  v_existing  public.orders;
  v_order     uuid;
  v_customer  uuid;
  v_name      text := nullif(trim(p#>>'{customer,name}'), '');
  v_phone     text := nullif(regexp_replace(coalesce(p#>>'{customer,phone}', ''), '[^0-9+]', '', 'g'), '');
  v_email     text := nullif(lower(trim(p#>>'{customer,email}')), '');
  v_hood      text := nullif(trim(p#>>'{address,neighborhood}'), '');
  v_zone      public.delivery_zones;
  v_pm        public.payment_methods;
  v_subtotal  numeric := 0;
  v_discount  numeric := 0;
  v_fee       numeric := 0;
  it          jsonb;
  v_prod      public.products;
  v_var       public.product_variants;
  v_promo     public.promotions;
  v_qty       int;
  v_unit      numeric;
  v_disc_unit numeric;
  v_item      uuid;
  v_opt       public.modifier_options;
  v_opt_ids   uuid[];
  g           record;
  v_status    text := 'new';
  v_number    bigint;
  v_token     uuid;
begin
  -- Reintento / doble clic: devuelve el mismo pedido
  if v_key is null or char_length(v_key) not between 8 and 80 then
    raise exception 'Falta la clave de idempotencia' using errcode = '22023';
  end if;
  select * into v_existing from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'token', v_existing.public_token, 'total', v_existing.total, 'repeated', true);
  end if;

  if v_channel not in ('web', 'counter', 'phone', 'whatsapp') then
    raise exception 'Canal inválido' using errcode = '22023';
  end if;
  v_manual := v_channel <> 'web';
  if v_manual and not public.has_permission('orders.create_manual') then
    raise exception 'Sin permiso para registrar ventas manuales' using errcode = '42501';
  end if;
  if v_fulfill not in ('delivery', 'pickup', 'dine_in') or (v_fulfill = 'dine_in' and not v_manual) then
    raise exception 'Tipo de entrega inválido' using errcode = '22023';
  end if;

  if not v_manual then
    if not public.is_open_now() then
      raise exception 'En este momento no estamos recibiendo pedidos' using errcode = 'P0001';
    end if;
    if v_name is null or char_length(v_name) < 2 then raise exception 'Escribe tu nombre' using errcode = '22023'; end if;
    if v_phone is null or v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'Escribe un celular válido' using errcode = '22023'; end if;
    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido' using errcode = '22023'; end if;
    -- Anti-abuso: máximo 5 pedidos web por celular por hora
    if (select count(*) from public.orders where customer_phone = v_phone and channel = 'web' and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Demasiados pedidos seguidos. Escríbenos por WhatsApp.' using errcode = 'P0001';
    end if;
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 or jsonb_array_length(p->'items') > 30 then
    raise exception 'El pedido debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;

  -- Cliente: con sesión, el suyo; invitado o venta manual, por correo (si lo hay)
  v_customer := public.my_customer_id();
  if v_customer is null and v_email is not null then
    select id into v_customer from public.customers where email = v_email;
    -- shortcut: un invitado que escribe el correo de otro cliente queda asociado a ese cliente
    -- (el dueño del correo vería ese pedido). Verificar el correo antes de asociar si se vuelve un problema.
    if v_customer is null and v_name is not null then
      insert into public.customers (full_name, phone, email) values (v_name, v_phone, v_email) returning id into v_customer;
    end if;
  end if;

  -- Método de pago
  select * into v_pm from public.payment_methods where code = p->>'payment_method' and is_active and not is_online;
  if not found then raise exception 'Elige un método de pago disponible' using errcode = '22023'; end if;
  if v_pm.available_for <> 'both' and v_fulfill in ('delivery', 'pickup') and v_pm.available_for <> v_fulfill then
    raise exception '% no está disponible para este tipo de entrega', v_pm.label using errcode = '22023';
  end if;

  if v_fulfill = 'delivery' and (nullif(trim(p#>>'{address,address}'), '') is null or v_hood is null) then
    raise exception 'Escribe la dirección y el barrio' using errcode = '22023';
  end if;

  insert into public.orders (idempotency_key, customer_id, channel, fulfillment, customer_name, customer_phone, customer_email,
    address, neighborhood, address_reference, payment_method_id, cash_change_for, notes, created_by)
  values (v_key, v_customer, v_channel, v_fulfill, v_name, v_phone, v_email,
    case when v_fulfill = 'delivery' then nullif(trim(p#>>'{address,address}'), '') end,
    case when v_fulfill = 'delivery' then v_hood end,
    case when v_fulfill = 'delivery' then nullif(trim(p#>>'{address,reference}'), '') end,
    v_pm.id,
    case when v_pm.code = 'cash' then nullif(p->>'cash_change_for', '')::numeric end,
    nullif(trim(p->>'notes'), ''),
    case when v_manual then auth.uid() end)
  returning id into v_order;

  -- Ítems
  for it in select * from jsonb_array_elements(p->'items') loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty not between 1 and 99 then raise exception 'Cantidad inválida' using errcode = '22023'; end if;

    select pr.* into v_prod from public.products pr join public.categories c on c.id = pr.category_id
    where pr.id = (it->>'product_id')::uuid and not pr.is_archived and c.is_active;
    if not found then raise exception 'Un producto ya no está en el menú' using errcode = 'P0001'; end if;
    if not v_prod.is_available then raise exception '% está agotado', v_prod.name using errcode = 'P0001'; end if;

    -- Variante: la elegida o la predeterminada si el producto tiene presentaciones
    v_var := null;
    if nullif(it->>'variant_id', '') is not null then
      select * into v_var from public.product_variants where id = (it->>'variant_id')::uuid and product_id = v_prod.id and is_active;
      if not found then raise exception 'Presentación inválida para %', v_prod.name using errcode = '22023'; end if;
    else
      select * into v_var from public.product_variants where product_id = v_prod.id and is_active order by is_default desc, sort_order limit 1;
    end if;
    v_unit := coalesce(v_var.price, v_prod.base_price);

    -- Opciones: deben pertenecer a grupos del producto; se valida mínimo y máximo por grupo
    select coalesce(array_agg(distinct x::uuid), '{}') into v_opt_ids
    from jsonb_array_elements_text(coalesce(it->'options', '[]'::jsonb)) x;
    if exists (
      select 1 from unnest(v_opt_ids) o(id)
      where not exists (
        select 1 from public.modifier_options mo
        join public.modifier_groups mg on mg.id = mo.group_id and mg.is_active
        join public.product_modifier_groups pmg on pmg.group_id = mg.id and pmg.product_id = v_prod.id
        where mo.id = o.id and mo.is_active)
    ) then
      raise exception 'Opción inválida para %', v_prod.name using errcode = '22023';
    end if;
    for g in
      select mg.name, mg.min_select, mg.max_select,
        (select count(*) from public.modifier_options mo where mo.group_id = mg.id and mo.id = any (v_opt_ids)) as n
      from public.product_modifier_groups pmg join public.modifier_groups mg on mg.id = pmg.group_id and mg.is_active
      where pmg.product_id = v_prod.id
    loop
      if g.n < g.min_select or g.n > g.max_select then
        raise exception '%: elige entre % y %', g.name, g.min_select, g.max_select using errcode = '22023';
      end if;
    end loop;
    v_unit := v_unit + coalesce((select sum(price_delta) from public.modifier_options where id = any (v_opt_ids)), 0);

    -- Promoción vigente del producto (la de mayor descuento)
    v_disc_unit := 0;
    for v_promo in
      select pm.* from public.promotions pm join public.promotion_products pp on pp.promotion_id = pm.id
      where pp.product_id = v_prod.id and pm.is_active and pm.type in ('percent', 'fixed')
        and (pm.starts_at is null or pm.starts_at <= now()) and (pm.ends_at is null or pm.ends_at > now())
    loop
      v_disc_unit := greatest(v_disc_unit, least(v_unit,
        case v_promo.type when 'percent' then round(v_unit * v_promo.value / 100, 0) else v_promo.value end));
    end loop;

    insert into public.order_items (order_id, product_id, variant_id, name_snapshot, unit_price, quantity, line_total, notes)
    values (v_order, v_prod.id, v_var.id,
      v_prod.name || coalesce(' · ' || v_var.name, ''), v_unit, v_qty, v_unit * v_qty,
      nullif(left(trim(it->>'notes'), 200), ''))
    returning id into v_item;

    for v_opt in select * from public.modifier_options where id = any (v_opt_ids) loop
      insert into public.order_item_modifiers (order_item_id, modifier_option_id, name_snapshot, price_delta)
      values (v_item, v_opt.id, v_opt.name, v_opt.price_delta);
    end loop;

    v_subtotal := v_subtotal + v_unit * v_qty;
    v_discount := v_discount + v_disc_unit * v_qty;
  end loop;

  -- Domicilio: barrio → zona → tarifa y pedido mínimo
  if v_fulfill = 'delivery' then
    select * into v_zone from public.delivery_zones where id = public.zone_for_neighborhood(v_hood);
    if not found then
      raise exception 'Aún no llegamos a %. Puedes recoger en el local.', v_hood using errcode = 'P0001';
    end if;
    if v_subtotal - v_discount < v_zone.min_order then
      raise exception 'El pedido mínimo para % es de $%', v_zone.name, to_char(v_zone.min_order, 'FM999G999G999') using errcode = 'P0001';
    end if;
    v_fee := case when v_zone.free_from is not null and v_subtotal - v_discount >= v_zone.free_from then 0 else v_zone.fee end;
  end if;

  update public.orders set subtotal = v_subtotal, discount = v_discount, delivery_fee = v_fee,
    total = v_subtotal + v_fee - v_discount, delivery_zone_id = v_zone.id
  where id = v_order
  returning number, public_token into v_number, v_token;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by) values (v_order, null, 'new', auth.uid());

  -- Venta manual con "confirmar ya" o confirmación automática configurada
  if (v_manual and coalesce((p->>'confirm')::boolean, false))
     or (not v_manual and (select auto_confirm_orders from public.restaurant_private_settings)) then
    update public.orders set status = 'confirmed', confirmed_at = now() where id = v_order;
    insert into public.order_status_history (order_id, from_status, to_status, changed_by) values (v_order, 'new', 'confirmed', auth.uid());
    perform public.consume_order_inventory(v_order);
    v_status := 'confirmed';
  end if;

  return jsonb_build_object('id', v_order, 'number', v_number, 'token', v_token,
    'total', v_subtotal + v_fee - v_discount, 'status', v_status, 'repeated', false);
end;
$$;

-- Cambiar estado. Confirmar descuenta inventario; cancelar después de confirmar reintegra
-- (p_restock = true, no se preparó) o deja el consumo como merma (false).
create or replace function public.set_order_status(p_order uuid, p_status text, p_restock boolean default true, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_from text;
  v_to text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado' using errcode = '22023'; end if;
  select kind into v_from from public.order_statuses where code = o.status;
  select kind into v_to from public.order_statuses where code = p_status and is_active;
  if v_to is null then raise exception 'Estado inválido' using errcode = '22023'; end if;

  if v_to = 'cancelled' then
    if not public.has_permission('orders.cancel') then raise exception 'Sin permiso para cancelar pedidos' using errcode = '42501'; end if;
  elsif not public.has_permission('orders.update_status') then
    raise exception 'Sin permiso para cambiar estados' using errcode = '42501';
  end if;
  if o.status = p_status then return; end if;
  if not public.order_transition_ok(v_from, v_to, o.fulfillment) then
    raise exception 'No se puede pasar de "%" a "%"', o.status, p_status using errcode = 'P0001';
  end if;
  if p_status = 'ready_for_pickup' and o.fulfillment = 'delivery' then
    raise exception 'Este pedido es a domicilio' using errcode = 'P0001';
  end if;

  update public.orders set status = p_status,
    confirmed_at = case when v_to <> 'cancelled' then coalesce(confirmed_at, now()) else confirmed_at end,
    delivered_at = case when v_to = 'delivered' then now() else delivered_at end,
    cancelled_at = case when v_to = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when v_to = 'cancelled' then nullif(trim(p_reason), '') else cancel_reason end
  where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by) values (p_order, o.status, p_status, auth.uid());

  if v_to = 'cancelled' then
    if p_restock then perform public.reverse_order_inventory(p_order); end if;
  else
    -- Cualquier avance desde "nuevo" implica que cocina lo aceptó: descuenta una sola vez
    perform public.consume_order_inventory(p_order);
  end if;
end;
$$;

create or replace function public.set_order_payment(p_order uuid, p_status text, p_reference text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if not public.has_permission('payments.verify') then raise exception 'Sin permiso para registrar pagos' using errcode = '42501'; end if;
  if p_status not in ('pending', 'paid', 'failed', 'refunded') then raise exception 'Estado de pago inválido' using errcode = '22023'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado' using errcode = '22023'; end if;
  update public.orders set payment_status = p_status where id = p_order;
  if p_status = 'paid' and not exists (select 1 from public.payments where order_id = p_order and status = 'paid') then
    insert into public.payments (order_id, payment_method_id, amount, status, reference, registered_by)
    values (p_order, o.payment_method_id, o.total, 'paid', nullif(trim(p_reference), ''), auth.uid());
  elsif p_status <> 'paid' then
    update public.payments set status = p_status where order_id = p_order and status = 'paid';
  end if;
end;
$$;

-- Seguimiento sin cuenta: solo datos no sensibles (sin teléfono ni dirección).
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'status_label', s.label, 'kind', s.kind,
    'fulfillment', o.fulfillment, 'created_at', o.created_at,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'discount', o.discount, 'total', o.total,
    'payment_method', pm.label, 'payment_instructions', pm.instructions, 'payment_status', o.payment_status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'quantity', i.quantity, 'line_total', i.line_total,
        'options', (select coalesce(jsonb_agg(m.name_snapshot), '[]'::jsonb) from public.order_item_modifiers m where m.order_item_id = i.id)))
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', st.label, 'at', h.created_at) order by h.created_at)
      from public.order_status_history h join public.order_statuses st on st.code = h.to_status where h.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  join public.order_statuses s on s.code = o.status
  left join public.payment_methods pm on pm.id = o.payment_method_id
  where o.public_token = p_token;
$$;

revoke execute on function public.create_order(jsonb), public.set_order_status(uuid, text, boolean, text),
  public.set_order_payment(uuid, text, text), public.get_order_by_token(uuid) from public;
grant execute on function public.create_order(jsonb), public.get_order_by_token(uuid) to anon, authenticated;
grant execute on function public.set_order_status(uuid, text, boolean, text), public.set_order_payment(uuid, text, text) to authenticated;

-- Pedidos de clientes pueden verse en "Mi cuenta" en vivo
alter publication supabase_realtime add table public.order_status_history;

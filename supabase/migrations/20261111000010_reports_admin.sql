-- 0010 · Gastos operativos, reportes y administración de usuarios

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (char_length(trim(category)) between 2 and 60),  -- arriendo, servicios, nómina…
  description text check (char_length(description) <= 300),
  amount      numeric(14,2) not null check (amount > 0),
  spent_on    date not null default (now() at time zone 'America/Bogota')::date,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index expenses_spent_idx on public.expenses (spent_on desc);
alter table public.expenses enable row level security;
create policy expenses_read on public.expenses for select to authenticated
  using (public.has_permission('expenses.manage') or public.has_permission('reports.read'));
create policy expenses_write on public.expenses for all to authenticated
  using (public.has_permission('expenses.manage')) with check (public.has_permission('expenses.manage'));
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_row();

-- Reporte del periodo (§11). Ventas = pedidos entregados; CMV = costo de insumos consumidos
-- por esos pedidos menos reintegros; nunca se llama "ganancia neta".
create or replace function public.sales_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('reports.read') then
    raise exception 'Sin permiso para ver reportes' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '366 days' then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;

  with d as (
    select o.* from public.orders o join public.order_statuses s on s.code = o.status
    where s.kind = 'delivered' and o.created_at >= p_from and o.created_at < p_to
  ),
  cogs as (
    select coalesce(-sum(m.qty_base * m.unit_cost), 0) as v
    from public.inventory_movements m join d on d.id = m.order_id
    where m.type in ('sale_consumption', 'sale_reversal')
  ),
  waste as (
    select coalesce(-sum(m.qty_base * m.unit_cost), 0) as v from public.inventory_movements m
    where m.type = 'waste' and m.created_at >= p_from and m.created_at < p_to
  ),
  exp as (
    select coalesce(sum(amount), 0) as v from public.expenses
    where spent_on >= (p_from at time zone 'America/Bogota')::date and spent_on < (p_to at time zone 'America/Bogota')::date
  )
  select jsonb_build_object(
    'gross_sales', coalesce((select sum(total) from d), 0),
    'delivery_fees', coalesce((select sum(delivery_fee) from d), 0),
    'discounts', coalesce((select sum(discount) from d), 0),
    'orders', (select count(*) from d),
    'cogs', round((select v from cogs), 2),
    'gross_margin', round(coalesce((select sum(total - delivery_fee) from d), 0) - (select v from cogs), 2),
    'waste', round((select v from waste), 2),
    'expenses', (select v from exp),
    'operating_profit', round(coalesce((select sum(total - delivery_fee) from d), 0) - (select v from cogs) - (select v from waste) - (select v from exp), 2),
    'by_payment', coalesce((select jsonb_agg(jsonb_build_object('method', coalesce(pm.label, 'Sin método'), 'sales', x.s, 'orders', x.n) order by x.s desc)
      from (select payment_method_id, sum(total) s, count(*) n from d group by 1) x left join public.payment_methods pm on pm.id = x.payment_method_id), '[]'::jsonb),
    'by_channel', coalesce((select jsonb_agg(jsonb_build_object('channel', channel, 'sales', s, 'orders', n) order by s desc)
      from (select channel, sum(total) s, count(*) n from d group by 1) x), '[]'::jsonb),
    'by_product', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'quantity', q, 'sales', s) order by s desc)
      from (select i.name_snapshot name, sum(i.quantity) q, sum(i.line_total) s
            from public.order_items i join d on d.id = i.order_id group by 1) x), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'sales', s, 'orders', n) order by d)
      from (select (created_at at time zone 'America/Bogota')::date d, sum(total) s, count(*) n from d group by 1) x), '[]'::jsonb),
    'inventory_value', (select round(coalesce(sum(greatest(stock_qty, 0) * avg_cost), 0), 2) from public.ingredients where is_active)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function public.sales_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.sales_report(timestamptz, timestamptz) to authenticated;

-- Lista de usuarios con sus roles (auth.users no es visible desde la API).
create or replace function public.admin_list_users()
returns table (id uuid, email text, full_name text, created_at timestamptz, confirmed boolean, roles text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('users.manage') then
    raise exception 'Sin permiso para gestionar usuarios' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.full_name, u.created_at, u.email_confirmed_at is not null,
      coalesce((select array_agg(r.code order by r.code) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = u.id), '{}')
    from auth.users u left join public.profiles p on p.id = u.id
    order by u.created_at desc
    limit 500;
end;
$$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;


-- 0005 · Clientes, direcciones y vinculación segura de pedidos de invitado
--
-- Un cliente puede existir sin cuenta (invitado o venta manual). Un correo = un cliente.
-- La cuenta se vincula SOLO cuando Supabase Auth confirma el correo; así nadie puede
-- registrarse con un correo ajeno y ver ese historial.

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users (id) on delete set null,
  full_name       text not null check (char_length(trim(full_name)) between 2 and 120),
  phone           text check (phone ~ '^\+?[0-9 ]{7,20}$'),
  email           text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_verified  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index customers_email_unique on public.customers (email) where email is not null;
create index customers_phone_idx on public.customers (phone);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create table public.customer_addresses (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  label             text check (char_length(label) <= 40),            -- “Casa”, “Trabajo”
  address           text not null check (char_length(trim(address)) between 5 and 200),
  neighborhood      text not null check (char_length(trim(neighborhood)) between 2 and 80),
  reference         text check (char_length(reference) <= 200),       -- “Casa esquinera, portón negro”
  delivery_zone_id  uuid references public.delivery_zones (id) on delete set null,
  is_default        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index customer_addresses_customer_idx on public.customer_addresses (customer_id);
create unique index customer_addresses_one_default on public.customer_addresses (customer_id) where is_default;
create trigger customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- La zona se calcula en el servidor a partir del barrio (el cliente no la elige).
create or replace function public.customer_address_set_zone()
returns trigger
language plpgsql
as $$
begin
  new.delivery_zone_id := public.zone_for_neighborhood(new.neighborhood);
  return new;
end;
$$;
create trigger customer_addresses_zone before insert or update on public.customer_addresses
  for each row execute function public.customer_address_set_zone();

-- Si cambian los barrios de una zona, recalcular direcciones guardadas.
create or replace function public.refresh_address_zones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_addresses
  set delivery_zone_id = public.zone_for_neighborhood(neighborhood);
  return null;
end;
$$;
create trigger delivery_zone_neighborhoods_refresh
  after insert or update or delete on public.delivery_zone_neighborhoods
  for each statement execute function public.refresh_address_zones();
create trigger delivery_zones_refresh
  after update of is_active or delete on public.delivery_zones
  for each statement execute function public.refresh_address_zones();

-- Cliente del usuario autenticado
create or replace function public.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.customers where user_id = auth.uid();
$$;

-- Vinculación al confirmar el correo.
create or replace function public.link_customer_on_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(new.email);
  v_name  text;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null and old.email is not distinct from new.email then
    return new;  -- ya estaba confirmado y vinculado
  end if;
  if exists (select 1 from public.customers where user_id = new.id) then
    return new;
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(v_email, '@', 1)
  );

  -- Reclama el cliente invitado con ese correo, o crea uno nuevo.
  update public.customers
  set user_id = new.id, email_verified = true
  where email = v_email and user_id is null;

  if not found then
    insert into public.customers (user_id, full_name, email, email_verified, phone)
    values (
      new.id,
      left(v_name, 120),
      v_email,
      true,
      nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9+ ]', '', 'g'), '')
    )
    on conflict (email) where email is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.link_customer_on_email_confirmed();

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

create policy customers_select on public.customers for select to authenticated
  using (user_id = auth.uid() or public.has_permission('customers.read'));
create policy customers_update_own on public.customers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy customers_staff_write on public.customers for all to authenticated
  using (public.has_permission('customers.manage')) with check (public.has_permission('customers.manage'));

-- El cliente solo puede editar nombre y teléfono; nunca user_id, email ni email_verified.
revoke update on public.customers from authenticated;
grant update (full_name, phone) on public.customers to authenticated;
revoke all on public.customers from anon;

create policy customer_addresses_own on public.customer_addresses for all to authenticated
  using (customer_id = public.my_customer_id())
  with check (customer_id = public.my_customer_id());
create policy customer_addresses_staff_read on public.customer_addresses for select to authenticated
  using (public.has_permission('customers.read'));
create policy customer_addresses_staff_write on public.customer_addresses for all to authenticated
  using (public.has_permission('customers.manage')) with check (public.has_permission('customers.manage'));
revoke all on public.customer_addresses from anon;

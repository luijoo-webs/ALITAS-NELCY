-- 0004 · Catálogo: categorías, productos, variantes, opciones/adicionales, promociones
-- El catálogo se crea VACÍO. Se carga desde el panel cuando el restaurante confirme precios y productos.

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 2 and 60),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text check (char_length(description) <= 300),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories (id) on delete restrict,
  name               text not null check (char_length(trim(name)) between 2 and 80),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description        text check (char_length(description) <= 500),
  base_price         numeric(12,2) not null check (base_price >= 0),
  is_available       boolean not null default true,
  availability_mode  text not null default 'manual' check (availability_mode in ('manual', 'auto_by_stock')),
  is_featured        boolean not null default false,
  is_archived        boolean not null default false,
  allergens          text[] not null default '{}',
  tags               text[] not null default '{}',
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, sort_order);
create index products_featured_idx on public.products (is_featured) where is_featured and not is_archived;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null,
  alt           text check (char_length(alt) <= 200),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  price       numeric(12,2) not null check (price >= 0),
  sku         text unique,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create unique index product_variants_one_default on public.product_variants (product_id) where is_default;
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Grupos de opciones: “Elige tu salsa”, “Principio”, “Arroz”, “Adicionales”…
create table public.modifier_groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 2 and 60),
  description  text,
  min_select   integer not null default 0 check (min_select >= 0),
  max_select   integer not null default 1 check (max_select >= 1),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (max_select >= min_select)
);
create trigger modifier_groups_updated_at before update on public.modifier_groups
  for each row execute function public.set_updated_at();

create table public.modifier_options (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.modifier_groups (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 60),
  price_delta  numeric(12,2) not null default 0 check (price_delta >= 0),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index modifier_options_group_idx on public.modifier_options (group_id, sort_order);
create trigger modifier_options_updated_at before update on public.modifier_options
  for each row execute function public.set_updated_at();

create table public.product_modifier_groups (
  product_id  uuid not null references public.products (id) on delete cascade,
  group_id    uuid not null references public.modifier_groups (id) on delete cascade,
  sort_order  integer not null default 0,
  primary key (product_id, group_id)
);
create index product_modifier_groups_group_idx on public.product_modifier_groups (group_id);

create table public.promotions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 2 and 80),
  description  text check (char_length(description) <= 300),
  type         text not null check (type in ('percent', 'fixed', 'label')),
  value        numeric(12,2) not null default 0,
  label        text check (char_length(label) <= 30),
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (
    (type = 'label' and value = 0)
    or (type = 'percent' and value > 0 and value <= 100)
    or (type = 'fixed' and value > 0)
  )
);
create trigger promotions_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();

create table public.promotion_products (
  promotion_id  uuid not null references public.promotions (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  primary key (promotion_id, product_id)
);
create index promotion_products_product_idx on public.promotion_products (product_id);

-- ── RLS: lectura pública de lo activo; escritura con catalog.manage ───────

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_products enable row level security;

create policy categories_read on public.categories for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy products_read on public.products for select to anon, authenticated
  using (
    (not is_archived and exists (select 1 from public.categories c where c.id = category_id and c.is_active))
    or public.has_permission('catalog.manage')
  );
create policy product_images_read on public.product_images for select to anon, authenticated using (true);
create policy product_variants_read on public.product_variants for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy modifier_groups_read on public.modifier_groups for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy modifier_options_read on public.modifier_options for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy product_modifier_groups_read on public.product_modifier_groups for select to anon, authenticated using (true);
create policy promotions_read on public.promotions for select to anon, authenticated
  using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or public.has_permission('catalog.manage')
  );
create policy promotion_products_read on public.promotion_products for select to anon, authenticated using (true);

create policy categories_write on public.categories for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy products_write on public.products for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy product_images_write on public.product_images for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy product_variants_write on public.product_variants for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy modifier_groups_write on public.modifier_groups for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy modifier_options_write on public.modifier_options for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy product_modifier_groups_write on public.product_modifier_groups for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy promotions_write on public.promotions for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy promotion_products_write on public.promotion_products for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

-- Auditoría: precios y disponibilidad
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_row();
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function public.audit_row();
create trigger modifier_options_audit after insert or update or delete on public.modifier_options
  for each row execute function public.audit_row();
create trigger promotions_audit after insert or update or delete on public.promotions
  for each row execute function public.audit_row();

-- ── Storage: fotos de productos (lectura pública, escritura con catalog.manage) ──

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy product_images_storage_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy product_images_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy product_images_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy product_images_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_permission('catalog.manage'));

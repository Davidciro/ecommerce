-- =============================================================================
-- 0300 · Catálogo: productos, imágenes y costes de producción (protegidos)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
-- sale_price: precio de venta tal como se muestra al público. Si
-- store_settings.prices_include_vat = true (habitual en B2C suizo), es precio con IVA.
-- Un producto puede guardarse incompleto como borrador (is_active = false), pero
-- para activarlo exige nombre y slug en los 3 idiomas.
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  sku                text unique check (sku is null or length(sku) between 1 and 64),

  slug               jsonb not null default public.empty_localized(),
  name               jsonb not null default public.empty_localized(),
  short_description  jsonb not null default public.empty_localized(),
  long_description   jsonb not null default public.empty_localized(),

  -- SEO específico del producto (la gestión SEO de páginas estáticas está en seo_pages)
  seo_title          jsonb not null default public.empty_localized(),
  seo_description    jsonb not null default public.empty_localized(),
  seo_keywords       jsonb not null default public.empty_localized_array(),

  sale_price         numeric(10, 2) not null check (sale_price >= 0),
  stock              integer not null default 0 check (stock >= 0),

  is_active          boolean not null default false,
  is_featured        boolean not null default false,
  sort_order         integer not null default 0,

  search_vector      tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig,
      coalesce(name ->> 'es', '') || ' ' || coalesce(name ->> 'fr', '') || ' ' || coalesce(name ->> 'de', '')), 'A')
    ||
    setweight(to_tsvector('simple'::regconfig,
      coalesce(short_description ->> 'es', '') || ' ' || coalesce(short_description ->> 'fr', '') || ' ' ||
      coalesce(short_description ->> 'de', '')), 'B')
  ) stored,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint products_slug_valid              check (public.is_valid_localized_slug(slug)),
  constraint products_name_localized          check (public.is_localized_text(name)),
  constraint products_short_desc_localized    check (public.is_localized_text(short_description)),
  constraint products_long_desc_localized     check (public.is_localized_text(long_description)),
  constraint products_seo_title_localized     check (public.is_localized_text(seo_title)),
  constraint products_seo_desc_localized      check (public.is_localized_text(seo_description)),
  constraint products_seo_keywords_localized  check (public.is_localized_string_array(seo_keywords)),
  constraint products_active_requires_content check (
    not is_active or (public.has_all_locales(name) and public.has_all_locales(slug))
  )
);

-- Slug único por idioma (ignorando borradores vacíos)
create unique index products_slug_es_key on public.products ((slug ->> 'es')) where slug ->> 'es' <> '';
create unique index products_slug_fr_key on public.products ((slug ->> 'fr')) where slug ->> 'fr' <> '';
create unique index products_slug_de_key on public.products ((slug ->> 'de')) where slug ->> 'de' <> '';

create index products_active_sort_idx   on public.products (is_active, sort_order, created_at desc);
create index products_featured_idx      on public.products (sort_order) where is_active and is_featured;
create index products_search_idx        on public.products using gin (search_vector);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- product_images (máx. 3 por producto, garantizado por position ∈ {0,1,2} + UNIQUE)
-- -----------------------------------------------------------------------------
-- storage_path: ruta dentro del bucket `product-images`, p. ej. products/<product_id>/<uuid>.webp
-- La restricción UNIQUE es DEFERRABLE para poder reordenar (swap) en una transacción.
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null unique check (storage_path ~ '^products/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  alt           jsonb not null default public.empty_localized() check (public.is_localized_text(alt)),
  position      smallint not null check (position between 0 and 2),
  width         integer check (width is null or width > 0),
  height        integer check (height is null or height > 0),
  size_bytes    integer check (size_bytes is null or size_bytes between 1 and 2097152),
  created_at    timestamptz not null default now(),
  constraint product_images_position_key unique (product_id, position) deferrable initially deferred
);

create index product_images_product_idx on public.product_images (product_id, position);

-- -----------------------------------------------------------------------------
-- product_costs — PROTEGIDA: solo admin. Nunca se une en consultas públicas.
-- -----------------------------------------------------------------------------
create table public.product_costs (
  product_id        uuid primary key references public.products (id) on delete cascade,
  production_price  numeric(10, 2) not null check (production_price >= 0),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null
);

create trigger product_costs_set_updated_at
  before update on public.product_costs
  for each row execute function public.set_updated_at();

comment on table public.product_costs is
  'Coste de producción. Acceso exclusivo admin (RLS). No exponer en endpoints públicos.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.product_costs  enable row level security;

-- products: lectura pública solo de activos; admin todo.
create policy "products: public read active"
  on public.products for select to anon, authenticated
  using (is_active);

create policy "products: admin full access"
  on public.products for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- product_images: lectura pública si el producto está activo.
create policy "product_images: public read of active products"
  on public.product_images for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.is_active
  ));

create policy "product_images: admin full access"
  on public.product_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- product_costs: SOLO admin. Sin acceso anónimo a nivel de privilegios.
revoke all on public.product_costs from anon;

create policy "product_costs: admin select"
  on public.product_costs for select to authenticated
  using ((select public.is_admin()));

create policy "product_costs: admin insert"
  on public.product_costs for insert to authenticated
  with check ((select public.is_admin()));

create policy "product_costs: admin update"
  on public.product_costs for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "product_costs: admin delete"
  on public.product_costs for delete to authenticated
  using ((select public.is_admin()));

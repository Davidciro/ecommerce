-- =============================================================================
-- 0400 · CMS de secciones, SEO por página, configuración de tienda y secretos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- site_sections — contenido editable de las vistas públicas
-- -----------------------------------------------------------------------------
-- key:      identificador estable usado por el frontend, p. ej. 'home.hero', 'about.story'
-- content:  SOLO campos localizados  → {"title": {es,fr,de}, "body": {es,fr,de}, ...}
-- settings: campos NO traducibles    → {"phones": ["+41 ..."], "map_url": "...", "since_year": 2009}
create table public.site_sections (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  page          text not null check (page in ('global', 'home', 'about', 'products', 'legal')),
  content       jsonb not null default '{}'::jsonb check (public.is_localized_map(content)),
  settings      jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  is_published  boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null
);

create index site_sections_page_idx on public.site_sections (page, sort_order);

create trigger site_sections_set_updated_at
  before update on public.site_sections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- seo_pages — módulo admin de palabras clave y metadatos por página e idioma
-- -----------------------------------------------------------------------------
-- page_key:   'home', 'about', 'products', 'legal_impressum', ...
-- route_path: ruta SIN prefijo de idioma ('/', '/about', '/legal/impressum').
--             El frontend genera /es/..., /fr/..., /de/... y los hreflang.
create table public.seo_pages (
  id                  uuid primary key default gen_random_uuid(),
  page_key            text not null unique check (page_key ~ '^[a-z0-9_]+$'),
  route_path          text not null unique check (route_path ~ '^/[a-z0-9/_-]*$'),
  meta_title          jsonb not null default public.empty_localized()
                        check (public.is_localized_text(meta_title)),
  meta_description    jsonb not null default public.empty_localized()
                        check (public.is_localized_text(meta_description)),
  keywords            jsonb not null default public.empty_localized_array()
                        check (public.is_localized_string_array(keywords)),
  og_image_path       text,          -- ruta en bucket site-assets
  noindex             boolean not null default false,
  include_in_sitemap  boolean not null default true,
  sitemap_changefreq  text not null default 'weekly'
                        check (sitemap_changefreq in ('always','hourly','daily','weekly','monthly','yearly','never')),
  sitemap_priority    numeric(2, 1) not null default 0.5 check (sitemap_priority between 0 and 1),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users (id) on delete set null
);

create trigger seo_pages_set_updated_at
  before update on public.seo_pages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- store_settings — configuración NO secreta (lectura pública). Fila única id = 1.
-- -----------------------------------------------------------------------------
-- payment_methods: valores de `payment_method_types` de Stripe Checkout.
--   'card' incluye Apple Pay y Google Pay (wallets) automáticamente si están
--   activados en el Dashboard de Stripe y el dominio está verificado.
--   'twint' SOLO admite CHF → se fuerza con un CHECK.
create table public.store_settings (
  id                       smallint primary key default 1 check (id = 1),
  store_name               text not null default 'My Store',
  legal_name               text,
  vat_number               text,                 -- p. ej. CHE-123.456.789 MWST
  currency                 public.currency_code not null default 'CHF',
  vat_rate                 numeric(5, 2) not null default 8.10 check (vat_rate >= 0 and vat_rate < 100),
  prices_include_vat       boolean not null default true,
  shipping_fee             numeric(10, 2) not null default 0 check (shipping_fee >= 0),
  free_shipping_threshold  numeric(10, 2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  shipping_countries       text[] not null default array['CH', 'LI'],
  payment_methods          text[] not null default array['card', 'twint'],
  stripe_publishable_key   text check (stripe_publishable_key is null or stripe_publishable_key ~ '^pk_(test|live)_[A-Za-z0-9]+$'),
  default_locale           public.locale_code not null default 'de',
  contact_email            text,
  low_stock_threshold      integer not null default 5 check (low_stock_threshold >= 0),
  max_quantity_per_item    integer not null default 20 check (max_quantity_per_item between 1 and 999),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users (id) on delete set null,

  constraint store_settings_payment_methods_allowed
    check (payment_methods <@ array['card', 'twint', 'paypal', 'klarna', 'sepa_debit']::text[]
           and cardinality(payment_methods) > 0),
  constraint store_settings_twint_requires_chf
    check (not ('twint' = any (payment_methods)) or currency = 'CHF'),
  constraint store_settings_shipping_countries_iso
    check (cardinality(shipping_countries) > 0
           and array_to_string(shipping_countries, ',') ~ '^[A-Z]{2}(,[A-Z]{2})*$')
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- store_secrets — llaves secretas de Stripe del DUEÑO. Fila única id = 1.
-- -----------------------------------------------------------------------------
-- RLS habilitado SIN políticas + privilegios revocados → solo service_role
-- (SUPABASE_SERVICE_ROLE_KEY, exclusivamente en el servidor Nitro) puede leerla.
-- El admin escribe vía RPC write-only (admin_set_stripe_secrets) y consulta
-- únicamente un estado enmascarado (admin_get_stripe_secrets_status).
create table public.store_secrets (
  id                     smallint primary key default 1 check (id = 1),
  stripe_secret_key      text check (stripe_secret_key is null or stripe_secret_key ~ '^(sk|rk)_(test|live)_[A-Za-z0-9]+$'),
  stripe_webhook_secret  text check (stripe_webhook_secret is null or stripe_webhook_secret ~ '^whsec_[A-Za-z0-9]+$'),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references auth.users (id) on delete set null
);

create trigger store_secrets_set_updated_at
  before update on public.store_secrets
  for each row execute function public.set_updated_at();

comment on table public.store_secrets is
  'Secretos de Stripe del dueño. Sin políticas RLS: solo legible con service_role desde el servidor.';

-- RPC write-only para que el admin guarde las llaves (pasar NULL = no cambiar).
create or replace function public.admin_set_stripe_secrets(
  p_stripe_secret_key     text default null,
  p_stripe_webhook_secret text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.store_secrets (id, stripe_secret_key, stripe_webhook_secret, updated_by)
  values (1, nullif(btrim(p_stripe_secret_key), ''), nullif(btrim(p_stripe_webhook_secret), ''), auth.uid())
  on conflict (id) do update
     set stripe_secret_key     = coalesce(excluded.stripe_secret_key, public.store_secrets.stripe_secret_key),
         stripe_webhook_secret = coalesce(excluded.stripe_webhook_secret, public.store_secrets.stripe_webhook_secret),
         updated_by            = auth.uid();
end;
$$;

-- Estado enmascarado: nunca devuelve la llave completa.
create or replace function public.admin_get_stripe_secrets_status()
returns table (
  secret_key_configured      boolean,
  secret_key_mode            text,
  secret_key_last4           text,
  webhook_secret_configured  boolean,
  updated_at                 timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select s.stripe_secret_key is not null,
         case when s.stripe_secret_key ~ '_live_' then 'live'
              when s.stripe_secret_key ~ '_test_' then 'test' end,
         right(s.stripe_secret_key, 4),
         s.stripe_webhook_secret is not null,
         s.updated_at
  from public.store_secrets s
  where s.id = 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.site_sections  enable row level security;
alter table public.seo_pages      enable row level security;
alter table public.store_settings enable row level security;
alter table public.store_secrets  enable row level security;

-- site_sections
create policy "site_sections: public read published"
  on public.site_sections for select to anon, authenticated
  using (is_published);

create policy "site_sections: admin full access"
  on public.site_sections for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- seo_pages
create policy "seo_pages: public read"
  on public.seo_pages for select to anon, authenticated
  using (true);

create policy "seo_pages: admin full access"
  on public.seo_pages for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- store_settings: lectura pública (no contiene secretos), escritura admin (sin insert/delete: fila única).
create policy "store_settings: public read"
  on public.store_settings for select to anon, authenticated
  using (true);

create policy "store_settings: admin update"
  on public.store_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- store_secrets: SIN políticas. Privilegios revocados por defensa en profundidad.
revoke all on public.store_secrets from public, anon, authenticated;

-- RPCs de secretos: solo usuarios autenticados (el chequeo admin está dentro).
revoke execute on function public.admin_set_stripe_secrets(text, text)  from public, anon;
revoke execute on function public.admin_get_stripe_secrets_status()      from public, anon;
grant  execute on function public.admin_set_stripe_secrets(text, text)  to authenticated, service_role;
grant  execute on function public.admin_get_stripe_secrets_status()      to authenticated, service_role;

-- =============================================================================
-- 0100 · Extensiones, tipos enumerados y funciones auxiliares
-- -----------------------------------------------------------------------------
-- Convenciones globales del esquema:
--   * Todo texto visible al público se guarda como JSONB {"es": "", "fr": "", "de": ""}.
--   * Importes monetarios: numeric(10,2)/(12,2) en la moneda de la tienda (CHF/EUR).
--     La conversión a unidades mínimas (céntimos/Rappen) para Stripe se hace en el servidor.
--   * Funciones SECURITY DEFINER siempre con `set search_path = ''` y nombres cualificados.
--   * RLS habilitado en TODAS las tablas de `public`.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.app_role       as enum ('admin', 'customer');
create type public.locale_code    as enum ('es', 'fr', 'de');
create type public.currency_code  as enum ('CHF', 'EUR');

-- Estados de pedido (la UI los traduce: pendiente / en curso / enviado / finalizado / cancelado)
create type public.order_status   as enum ('pending', 'in_progress', 'shipped', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded', 'partially_refunded');

-- -----------------------------------------------------------------------------
-- Validadores de contenido multilenguaje (usados en CHECK constraints)
-- -----------------------------------------------------------------------------

-- {"es": "...", "fr": "...", "de": "..."} — exactamente esas 3 claves, todas string.
create or replace function public.is_localized_text(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select j is not null
     and jsonb_typeof(j) = 'object'
     and j ?& array['es', 'fr', 'de']
     and (j - array['es', 'fr', 'de']) = '{}'::jsonb
     and jsonb_typeof(j -> 'es') = 'string'
     and jsonb_typeof(j -> 'fr') = 'string'
     and jsonb_typeof(j -> 'de') = 'string';
$$;

-- Igual que is_localized_text, pero además los 3 idiomas no vacíos.
create or replace function public.has_all_locales(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_localized_text(j)
     and length(btrim(j ->> 'es')) > 0
     and length(btrim(j ->> 'fr')) > 0
     and length(btrim(j ->> 'de')) > 0;
$$;

-- {"es": ["k1","k2"], "fr": [...], "de": [...]} — arrays de strings por idioma.
create or replace function public.is_localized_string_array(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select j is not null
     and jsonb_typeof(j) = 'object'
     and j ?& array['es', 'fr', 'de']
     and (j - array['es', 'fr', 'de']) = '{}'::jsonb
     and jsonb_typeof(j -> 'es') = 'array'
     and jsonb_typeof(j -> 'fr') = 'array'
     and jsonb_typeof(j -> 'de') = 'array'
     and not exists (
       select 1
       from jsonb_array_elements((j -> 'es') || (j -> 'fr') || (j -> 'de')) as e(v)
       where jsonb_typeof(e.v) <> 'string'
     );
$$;

-- Objeto cuyos valores son TODOS textos localizados: {"title": {es,fr,de}, "body": {es,fr,de}}
create or replace function public.is_localized_map(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select j is not null
     and jsonb_typeof(j) = 'object'
     and not exists (
       select 1 from jsonb_each(j) as e(k, v)
       where not public.is_localized_text(e.v)
     );
$$;

-- Slugs SEO localizados: cada idioma vacío (borrador) o kebab-case ASCII.
create or replace function public.is_valid_localized_slug(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_localized_text(j)
     and (j ->> 'es' = '' or j ->> 'es' ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
     and (j ->> 'fr' = '' or j ->> 'fr' ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
     and (j ->> 'de' = '' or j ->> 'de' ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
$$;

-- Valor por defecto para columnas localizadas.
create or replace function public.empty_localized()
returns jsonb
language sql
immutable
set search_path = ''
as $$ select '{"es": "", "fr": "", "de": ""}'::jsonb; $$;

create or replace function public.empty_localized_array()
returns jsonb
language sql
immutable
set search_path = ''
as $$ select '{"es": [], "fr": [], "de": []}'::jsonb; $$;

-- -----------------------------------------------------------------------------
-- Trigger genérico updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

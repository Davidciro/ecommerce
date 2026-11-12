-- =============================================================================
-- 20261113000100 · Idioma por defecto: francés (fr)
-- -----------------------------------------------------------------------------
-- Cambia los DEFAULT de las columnas de idioma y el fallback del alta de usuarios.
-- No modifica preferencias ya elegidas por usuarios existentes.
-- =============================================================================

alter table public.profiles               alter column preferred_locale set default 'fr';
alter table public.store_settings         alter column default_locale   set default 'fr';
alter table public.checkout_drafts        alter column locale           set default 'fr';
alter table public.orders                 alter column locale           set default 'fr';
alter table public.newsletter_subscribers alter column locale           set default 'fr';
alter table public.contact_messages       alter column locale           set default 'fr';

update public.store_settings set default_locale = 'fr' where id = 1;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, email, full_name, preferred_locale)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when v_locale in ('es', 'fr', 'de') then v_locale::public.locale_code else 'fr' end
  )
  on conflict (id) do nothing;
  -- role NO se toma de metadata: siempre 'customer' por defecto.
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

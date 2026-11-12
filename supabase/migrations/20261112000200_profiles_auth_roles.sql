-- =============================================================================
-- 0200 · Perfiles, roles y helpers de autorización
-- -----------------------------------------------------------------------------
-- Fuente de verdad del rol: public.profiles.role.
--   * Todo usuario nuevo (email/password o Google OAuth) nace como 'customer'.
--   * NUNCA se deriva el rol de raw_user_meta_data (lo controla el usuario).
--   * El rol 'admin' solo se asigna manualmente (SQL editor / service_role).
--   * Se replica en auth.users.raw_app_meta_data.role para que el JWT lo lleve
--     (útil para el middleware de Nuxt), pero RLS siempre consulta profiles.
-- =============================================================================

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text check (full_name is null or length(full_name) <= 200),
  phone             text check (phone is null or length(phone) <= 40),
  role              public.app_role not null default 'customer',
  preferred_locale  public.locale_code not null default 'de',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is 'Perfil 1:1 con auth.users. role es la fuente de verdad para autorización.';

-- -----------------------------------------------------------------------------
-- Helpers de autorización (usados en políticas RLS y RPCs)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

-- Para RPCs que pueden invocarse desde server routes con SERVICE_ROLE_KEY.
-- IMPORTANTE: se basa SOLO en el claim del JWT de la petición. No usar current_user:
-- dentro de una función SECURITY DEFINER valdría el owner ('postgres') y daría true siempre.
create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
$$;

create or replace function public.is_admin_or_service()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_service_role() or public.is_admin();
$$;

-- -----------------------------------------------------------------------------
-- Alta automática del perfil al registrarse
-- -----------------------------------------------------------------------------
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
    case when v_locale in ('es', 'fr', 'de') then v_locale::public.locale_code else 'de' end
  )
  on conflict (id) do nothing;
  -- role NO se toma de metadata: siempre 'customer' por defecto.
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sincroniza cambios de email (confirmación de cambio de email en Supabase Auth)
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Replica el rol en app_metadata (claim `app_metadata.role` en el JWT tras refrescar sesión)
create or replace function public.sync_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', new.role::text)
   where id = new.id;
  return new;
end;
$$;

create trigger on_profile_role_changed
  after update of role on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.sync_role_to_auth();

-- -----------------------------------------------------------------------------
-- RLS + privilegios a nivel de columna
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Los clientes solo pueden modificar estas columnas (nunca role ni email).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, preferred_locale) on public.profiles to authenticated;

create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admin can read all"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

create policy "profiles: owner can update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Funciones internas de trigger: nadie debe poder invocarlas vía RPC.
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.sync_role_to_auth()        from public, anon, authenticated;

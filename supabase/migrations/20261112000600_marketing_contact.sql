-- =============================================================================
-- 0600 · Newsletter, campañas de correo (Resend), logs de email y contacto
-- -----------------------------------------------------------------------------
-- Consentimiento (nFADP / GDPR / UWG art. 3 lit. o): las campañas solo se envían
-- a suscriptores con status = 'subscribed'. Los registros desde formularios
-- públicos usan doble opt-in ('pending' → 'subscribed' al confirmar el enlace).
-- =============================================================================

create table public.newsletter_subscribers (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id            uuid references auth.users (id) on delete set null,
  locale             public.locale_code not null default 'de',
  status             text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed')),
  confirm_token      uuid default gen_random_uuid(),
  unsubscribe_token  uuid not null default gen_random_uuid() unique,
  source             text not null default 'footer' check (source in ('footer', 'account', 'checkout', 'admin_import')),
  confirmed_at       timestamptz,
  unsubscribed_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index newsletter_subscribers_user_idx   on public.newsletter_subscribers (user_id);
create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status, locale);

create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- email_campaigns
-- -----------------------------------------------------------------------------
-- segment: {"type": "all_subscribers" | "customers" | "customers_with_orders" | "customers_without_orders",
--           "locales": ["de","fr"]   -- opcional; si falta = todos}
create or replace function public.is_valid_campaign_segment(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(j) = 'object'
     and j ->> 'type' in ('all_subscribers', 'customers', 'customers_with_orders', 'customers_without_orders')
     and (
       not (j ? 'locales')
       or (jsonb_typeof(j -> 'locales') = 'array'
           and (j -> 'locales') <@ '["es","fr","de"]'::jsonb)
     );
$$;

create table public.email_campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(name) between 1 and 200),
  subject           jsonb not null default public.empty_localized() check (public.is_localized_text(subject)),
  preheader         jsonb not null default public.empty_localized() check (public.is_localized_text(preheader)),
  body_html         jsonb not null default public.empty_localized() check (public.is_localized_text(body_html)),
  body_text         jsonb not null default public.empty_localized() check (public.is_localized_text(body_text)),
  segment           jsonb not null default '{"type": "all_subscribers"}'::jsonb
                      check (public.is_valid_campaign_segment(segment)),
  status            text not null default 'draft'
                      check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  recipients_count  integer not null default 0,
  sent_count        integer not null default 0,
  failed_count      integer not null default 0,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index email_campaigns_status_idx on public.email_campaigns (status, created_at desc);

create trigger email_campaigns_set_updated_at
  before update on public.email_campaigns
  for each row execute function public.set_updated_at();

create table public.email_campaign_recipients (
  id                 bigint generated always as identity primary key,
  campaign_id        uuid not null references public.email_campaigns (id) on delete cascade,
  subscriber_id      uuid references public.newsletter_subscribers (id) on delete set null,
  email              text not null,
  locale             public.locale_code not null,
  status             text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'bounced')),
  resend_message_id  text,
  error              text,
  sent_at            timestamptz,
  unique (campaign_id, email)
);

create index email_campaign_recipients_status_idx on public.email_campaign_recipients (campaign_id, status);

-- -----------------------------------------------------------------------------
-- email_logs — correos transaccionales (confirmación, cambio de estado, contacto...)
-- -----------------------------------------------------------------------------
create table public.email_logs (
  id                 bigint generated always as identity primary key,
  kind               text not null check (kind in (
                       'order_confirmation', 'order_status', 'admin_new_order',
                       'contact_form', 'newsletter_confirm', 'campaign')),
  to_email           text not null,
  order_id           uuid references public.orders (id) on delete set null,
  resend_message_id  text,
  status             text not null default 'sent' check (status in ('sent', 'failed')),
  error              text,
  created_at         timestamptz not null default now()
);

create index email_logs_order_idx   on public.email_logs (order_id);
create index email_logs_created_idx on public.email_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- contact_messages — formulario de "Quiénes somos" (insertado por el servidor
-- tras validación + rate limit + anti-spam; nunca directo desde el cliente)
-- -----------------------------------------------------------------------------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 200),
  email       text not null check (length(email) between 3 and 320),
  phone       text check (phone is null or length(phone) <= 40),
  subject     text check (subject is null or length(subject) <= 300),
  message     text not null check (length(message) between 1 and 5000),
  locale      public.locale_code not null default 'de',
  user_id     uuid references auth.users (id) on delete set null,
  is_handled  boolean not null default false,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index contact_messages_created_idx on public.contact_messages (is_handled, created_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.newsletter_subscribers    enable row level security;
alter table public.email_campaigns           enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.email_logs                enable row level security;
alter table public.contact_messages          enable row level security;

-- newsletter_subscribers: el usuario ve su propia suscripción y la cambia vía RPC
-- (set_my_newsletter_subscription). Altas anónimas → server route con doble opt-in.
revoke all on public.newsletter_subscribers from anon;

create policy "newsletter: owner reads own"
  on public.newsletter_subscribers for select to authenticated
  using (user_id = (select auth.uid()));

create policy "newsletter: admin full access"
  on public.newsletter_subscribers for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Campañas, destinatarios, logs y mensajes de contacto: solo admin.
revoke all on public.email_campaigns           from anon;
revoke all on public.email_campaign_recipients from anon;
revoke all on public.email_logs                from anon;
revoke all on public.contact_messages          from anon;

create policy "email_campaigns: admin full access"
  on public.email_campaigns for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "email_campaign_recipients: admin read"
  on public.email_campaign_recipients for select to authenticated
  using ((select public.is_admin()));

create policy "email_logs: admin read"
  on public.email_logs for select to authenticated
  using ((select public.is_admin()));

create policy "contact_messages: admin read"
  on public.contact_messages for select to authenticated
  using ((select public.is_admin()));

create policy "contact_messages: admin update"
  on public.contact_messages for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "contact_messages: admin delete"
  on public.contact_messages for delete to authenticated
  using ((select public.is_admin()));

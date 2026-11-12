-- =============================================================================
-- 0500 · Checkout, pedidos, líneas, costes snapshot, historial y eventos Stripe
-- -----------------------------------------------------------------------------
-- Flujo:
--   1. /api/checkout (servidor) lee precios REALES de products, calcula IVA y envío,
--      inserta un checkout_draft con el snapshot de líneas e importes, y crea la
--      Stripe Checkout Session (metadata.draft_id). Guarda stripe_session_id en el draft.
--   2. /api/webhooks/stripe (checkout.session.completed) llama a la RPC
--      finalize_checkout(session_id, ...) → crea order + order_items + costes snapshot
--      y descuenta stock de forma atómica e idempotente.
--   3. checkout.session.expired → el servidor marca el draft como 'expired'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- checkout_drafts — solo servidor (service_role)
-- -----------------------------------------------------------------------------
-- items: [{ "product_id": uuid, "quantity": int, "unit_price": num,
--           "line_total": num, "line_tax": num, "line_net": num,
--           "name": {es,fr,de}, "slug": {es,fr,de}, "image_path": text|null }]
create table public.checkout_drafts (
  id                  uuid primary key default gen_random_uuid(),
  stripe_session_id   text unique,
  user_id             uuid references auth.users (id) on delete set null,
  email               text check (email is null or email = lower(email)),
  locale              public.locale_code not null default 'de',
  currency            public.currency_code not null,
  items               jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
  subtotal            numeric(12, 2) not null check (subtotal >= 0),
  shipping_amount     numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  tax_amount          numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total               numeric(12, 2) not null check (total >= 0),
  vat_rate            numeric(5, 2) not null,
  prices_include_vat  boolean not null,
  status              text not null default 'open' check (status in ('open', 'completed', 'expired')),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '24 hours',
  completed_at        timestamptz,
  constraint checkout_drafts_total_consistent check (
    total = subtotal + shipping_amount + case when prices_include_vat then 0 else tax_amount end
  )
);

create index checkout_drafts_status_created_idx on public.checkout_drafts (status, created_at);

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  order_number                bigint generated always as identity (start with 100001) unique,
  user_id                     uuid references auth.users (id) on delete set null,
  checkout_draft_id           uuid references public.checkout_drafts (id) on delete set null,

  email                       text not null check (email = lower(email)),
  customer_name               text,
  phone                       text,
  locale                      public.locale_code not null default 'de',

  status                      public.order_status   not null default 'pending',
  payment_status              public.payment_status not null default 'paid',

  currency                    public.currency_code not null,
  subtotal                    numeric(12, 2) not null check (subtotal >= 0),
  shipping_amount             numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  tax_amount                  numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total                       numeric(12, 2) not null check (total >= 0),
  vat_rate                    numeric(5, 2) not null,
  prices_include_vat          boolean not null,

  shipping_address            jsonb check (shipping_address is null or jsonb_typeof(shipping_address) = 'object'),
  billing_address             jsonb check (billing_address  is null or jsonb_typeof(billing_address)  = 'object'),

  stripe_checkout_session_id  text not null unique,
  stripe_payment_intent_id    text,
  payment_method_type         text,

  carrier                     text,
  tracking_number             text,
  tracking_url                text check (tracking_url is null or tracking_url ~ '^https://'),

  -- true si el stock se descontó (false si hubo conflicto de stock → needs_review)
  stock_committed             boolean not null default false,
  needs_review                boolean not null default false,
  review_reason               text,

  paid_at                     timestamptz,
  shipped_at                  timestamptz,
  completed_at                timestamptz,
  cancelled_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint orders_total_consistent check (
    total = subtotal + shipping_amount + case when prices_include_vat then 0 else tax_amount end
  )
);

create index orders_user_created_idx   on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_created_idx        on public.orders (created_at desc);
create index orders_email_idx          on public.orders (email);
create index orders_needs_review_idx   on public.orders (created_at desc) where needs_review;

-- -----------------------------------------------------------------------------
-- order_items — snapshot inmutable de lo comprado (visible para el cliente dueño)
-- -----------------------------------------------------------------------------
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  jsonb not null check (public.is_localized_text(product_name)),
  product_slug  jsonb check (product_slug is null or public.is_localized_text(product_slug)),
  image_path    text,
  unit_price    numeric(10, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12, 2) not null check (line_total >= 0),   -- importe cobrado por la línea
  line_tax      numeric(12, 2) not null default 0 check (line_tax >= 0),
  line_net      numeric(12, 2) not null check (line_net >= 0),     -- sin IVA (base para margen)
  created_at    timestamptz not null default now()
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- -----------------------------------------------------------------------------
-- order_item_costs — snapshot del coste de producción en el momento de la venta.
-- Tabla separada (solo admin) para no filtrar márgenes vía order_items.
-- -----------------------------------------------------------------------------
create table public.order_item_costs (
  order_item_id          uuid primary key references public.order_items (id) on delete cascade,
  unit_production_price  numeric(10, 2) not null check (unit_production_price >= 0),
  line_production_cost   numeric(12, 2) not null check (line_production_cost >= 0),
  cost_missing           boolean not null default false  -- no había product_costs al vender
);

-- -----------------------------------------------------------------------------
-- order_status_history — auditoría de cambios de estado
-- -----------------------------------------------------------------------------
create table public.order_status_history (
  id                    bigint generated always as identity primary key,
  order_id              uuid not null references public.orders (id) on delete cascade,
  from_status           public.order_status,
  to_status             public.order_status not null,
  changed_by            uuid references auth.users (id) on delete set null,
  note                  text,
  customer_notified_at  timestamptz,
  created_at            timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- -----------------------------------------------------------------------------
-- order_notes — notas internas del admin (nunca visibles al cliente)
-- -----------------------------------------------------------------------------
create table public.order_notes (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null,
  body        text not null check (length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);

create index order_notes_order_idx on public.order_notes (order_id, created_at);

-- -----------------------------------------------------------------------------
-- stripe_events — registro/idempotencia de webhooks
-- -----------------------------------------------------------------------------
create table public.stripe_events (
  id            text primary key,          -- evt_...
  type          text not null,
  livemode      boolean not null default false,
  processed_at  timestamptz not null default now(),
  error         text
);

-- -----------------------------------------------------------------------------
-- Triggers de pedidos
-- -----------------------------------------------------------------------------
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.orders_before_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'cancelled' then
      raise exception 'Order % is cancelled and cannot change status', old.order_number
        using errcode = 'P0001';
    end if;

    case new.status
      when 'shipped'   then new.shipped_at   := coalesce(new.shipped_at, now());
      when 'completed' then new.completed_at := coalesce(new.completed_at, now());
                            new.shipped_at   := coalesce(new.shipped_at, now());
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger orders_before_status_change
  before update of status on public.orders
  for each row execute function public.orders_before_status_change();

-- Registra en el historial. La nota opcional llega vía set_config('app.status_note', ..., true).
create or replace function public.orders_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    auth.uid(),
    nullif(current_setting('app.status_note', true), '')
  );
  return new;
end;
$$;

create trigger orders_log_status_insert
  after insert on public.orders
  for each row execute function public.orders_log_status();

create trigger orders_log_status_update
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.orders_log_status();

revoke execute on function public.orders_log_status() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.checkout_drafts      enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_item_costs     enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_notes          enable row level security;
alter table public.stripe_events        enable row level security;

-- Tablas exclusivas del servidor: sin políticas, sin privilegios.
revoke all on public.checkout_drafts from public, anon, authenticated;
revoke all on public.stripe_events   from public, anon, authenticated;

-- orders: el cliente ve los suyos; el admin ve todos.
-- Nadie inserta/borra desde el cliente: los pedidos los crea finalize_checkout().
-- El admin solo puede actualizar columnas logísticas; el estado cambia vía
-- admin_set_order_status() (gestiona reposición de stock e historial).
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (carrier, tracking_number, tracking_url) on public.orders to authenticated;

create policy "orders: customer reads own"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()));

create policy "orders: admin reads all"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

create policy "orders: admin updates logistics"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- order_items: solo lectura (cliente dueño / admin).
revoke insert, update, delete on public.order_items from anon, authenticated;

create policy "order_items: customer reads own"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid())
  ));

create policy "order_items: admin reads all"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

-- order_item_costs: solo admin, solo lectura.
revoke all on public.order_item_costs from public, anon;
revoke insert, update, delete on public.order_item_costs from authenticated;

create policy "order_item_costs: admin reads"
  on public.order_item_costs for select to authenticated
  using ((select public.is_admin()));

-- order_status_history: cliente lee el de sus pedidos; admin todo. Escritura solo por trigger/servidor.
revoke insert, update, delete on public.order_status_history from anon, authenticated;

create policy "order_status_history: customer reads own"
  on public.order_status_history for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id and o.user_id = (select auth.uid())
  ));

create policy "order_status_history: admin reads all"
  on public.order_status_history for select to authenticated
  using ((select public.is_admin()));

-- order_notes: solo admin.
revoke all on public.order_notes from anon;

create policy "order_notes: admin full access"
  on public.order_notes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

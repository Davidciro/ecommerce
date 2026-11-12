-- =============================================================================
-- 0700 · Funciones RPC de negocio
-- =============================================================================

-- -----------------------------------------------------------------------------
-- finalize_checkout — llamada SOLO por el webhook de Stripe (service_role)
-- -----------------------------------------------------------------------------
-- * Idempotente: si ya existe el pedido para la sesión, devuelve su id.
-- * Concurrencia: bloquea el draft (FOR UPDATE) y las filas de productos en orden
--   determinista (por id) para evitar deadlocks entre webhooks simultáneos.
-- * Stock: si TODO hay stock suficiente lo descuenta; si no, crea el pedido igual
--   (el cliente YA pagó) sin tocar stock y lo marca needs_review para que el admin
--   reembolse o reponga. Así nunca se pierde un pago ni se viola stock >= 0.
-- * Importe: si lo cobrado por Stripe no coincide con el draft → needs_review.
create or replace function public.finalize_checkout(
  p_stripe_session_id    text,
  p_payment_intent_id    text,
  p_email                text,
  p_customer_name        text,
  p_phone                text,
  p_shipping_address     jsonb,
  p_billing_address      jsonb,
  p_amount_total         numeric,   -- en unidades mayores (CHF/EUR), ya convertido desde céntimos
  p_currency             text,
  p_payment_method_type  text default null,
  p_payment_status       public.payment_status default 'paid'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft         public.checkout_drafts%rowtype;
  v_order_id      uuid;
  v_item          jsonb;
  v_item_id       uuid;
  v_qty           integer;
  v_cost          numeric(10, 2);
  v_insufficient  text[];
  v_reasons       text[] := '{}';
begin
  if not public.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_draft
  from public.checkout_drafts
  where stripe_session_id = p_stripe_session_id
  for update;

  if not found then
    raise exception 'checkout draft not found for session %', p_stripe_session_id using errcode = 'P0002';
  end if;

  -- Idempotencia (re-chequeo tras obtener el lock)
  select o.id into v_order_id from public.orders o where o.stripe_checkout_session_id = p_stripe_session_id;
  if found then
    return v_order_id;
  end if;

  -- Validación de importe y moneda cobrados
  if round(p_amount_total, 2) <> v_draft.total or upper(p_currency) <> v_draft.currency::text then
    v_reasons := v_reasons || format('amount_mismatch: charged %s %s, expected %s %s',
                                     p_amount_total, upper(p_currency), v_draft.total, v_draft.currency);
  end if;

  -- Lock de productos en orden determinista
  perform 1
  from public.products p
  where p.id in (select (e ->> 'product_id')::uuid from jsonb_array_elements(v_draft.items) e)
  order by p.id
  for update;

  -- Comprobación de stock agregada por producto
  select coalesce(array_agg(x.product_id::text), '{}')
    into v_insufficient
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::int) as qty
    from jsonb_array_elements(v_draft.items) e
    group by 1
  ) x
  left join public.products p on p.id = x.product_id
  where p.id is null or p.stock < x.qty;

  if cardinality(v_insufficient) > 0 then
    v_reasons := v_reasons || ('insufficient_stock: ' || array_to_string(v_insufficient, ','));
  end if;

  -- Pedido
  insert into public.orders (
    user_id, checkout_draft_id, email, customer_name, phone, locale,
    status, payment_status, currency,
    subtotal, shipping_amount, tax_amount, total, vat_rate, prices_include_vat,
    shipping_address, billing_address,
    stripe_checkout_session_id, stripe_payment_intent_id, payment_method_type,
    stock_committed, needs_review, review_reason, paid_at
  ) values (
    v_draft.user_id, v_draft.id,
    lower(coalesce(nullif(btrim(p_email), ''), v_draft.email)),
    p_customer_name, p_phone, v_draft.locale,
    'pending', p_payment_status, v_draft.currency,
    v_draft.subtotal, v_draft.shipping_amount, v_draft.tax_amount, v_draft.total,
    v_draft.vat_rate, v_draft.prices_include_vat,
    p_shipping_address, p_billing_address,
    p_stripe_session_id, p_payment_intent_id, p_payment_method_type,
    cardinality(v_insufficient) = 0,
    cardinality(v_reasons) > 0,
    nullif(array_to_string(v_reasons, ' | '), ''),
    case when p_payment_status = 'paid' then now() end
  )
  returning id into v_order_id;

  -- Líneas + snapshot de coste
  for v_item in select e from jsonb_array_elements(v_draft.items) e loop
    v_qty := (v_item ->> 'quantity')::int;

    insert into public.order_items (
      order_id, product_id, product_name, product_slug, image_path,
      unit_price, quantity, line_total, line_tax, line_net
    ) values (
      v_order_id,
      (select p.id from public.products p where p.id = (v_item ->> 'product_id')::uuid),
      v_item -> 'name',
      v_item -> 'slug',
      v_item ->> 'image_path',
      (v_item ->> 'unit_price')::numeric,
      v_qty,
      (v_item ->> 'line_total')::numeric,
      coalesce((v_item ->> 'line_tax')::numeric, 0),
      (v_item ->> 'line_net')::numeric
    )
    returning id into v_item_id;

    v_cost := (select pc.production_price from public.product_costs pc
               where pc.product_id = (v_item ->> 'product_id')::uuid);

    insert into public.order_item_costs (order_item_id, unit_production_price, line_production_cost, cost_missing)
    values (v_item_id, coalesce(v_cost, 0), coalesce(v_cost, 0) * v_qty, v_cost is null);
  end loop;

  -- Descuento atómico de stock (solo si había stock para todo)
  if cardinality(v_insufficient) = 0 then
    update public.products p
       set stock = p.stock - x.qty
      from (
        select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::int) as qty
        from jsonb_array_elements(v_draft.items) e
        group by 1
      ) x
     where p.id = x.product_id;
  end if;

  update public.checkout_drafts
     set status = 'completed', completed_at = now()
   where id = v_draft.id;

  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_set_order_status — cambio de estado con historial y reposición de stock
-- -----------------------------------------------------------------------------
-- p_restock: al cancelar, devuelve al stock las unidades si se habían descontado.
-- El envío del email al cliente lo hace el server route tras esta llamada, y luego
-- marca order_status_history.customer_notified_at (con service_role).
create or replace function public.admin_set_order_status(
  p_order_id  uuid,
  p_status    public.order_status,
  p_note      text default null,
  p_restock   boolean default true
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  if v_order.status = p_status then
    return v_order;
  end if;

  perform set_config('app.status_note', coalesce(p_note, ''), true);

  if p_status = 'cancelled' and p_restock and v_order.stock_committed then
    update public.products p
       set stock = p.stock + x.qty
      from (
        select oi.product_id, sum(oi.quantity) as qty
        from public.order_items oi
        where oi.order_id = p_order_id and oi.product_id is not null
        group by oi.product_id
      ) x
     where p.id = x.product_id;

    update public.orders set stock_committed = false where id = p_order_id;
  end if;

  update public.orders
     set status = p_status
   where id = p_order_id
  returning * into v_order;

  perform set_config('app.status_note', '', true);
  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reportería de ventas
-- -----------------------------------------------------------------------------
-- Se consideran ventas: payment_status = 'paid' y status <> 'cancelled'.
-- Rango semiabierto [p_from, p_to).
-- Ganancia neta = ingresos netos (sin IVA) − costes de producción snapshot.
create or replace function public.admin_sales_report(
  p_from        timestamptz,
  p_to          timestamptz,
  p_product_id  uuid default null
)
returns table (
  order_id               uuid,
  order_number           bigint,
  order_date             timestamptz,
  order_status           public.order_status,
  customer_email         text,
  customer_name          text,
  currency               public.currency_code,
  product_id             uuid,
  product_name           jsonb,
  quantity               integer,
  unit_price             numeric,
  line_total             numeric,
  line_tax               numeric,
  line_net               numeric,
  unit_production_price  numeric,
  line_production_cost   numeric,
  line_profit            numeric,
  cost_missing           boolean
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
  select o.id, o.order_number, o.created_at, o.status, o.email, o.customer_name, o.currency,
         oi.product_id, oi.product_name, oi.quantity, oi.unit_price,
         oi.line_total, oi.line_tax, oi.line_net,
         coalesce(c.unit_production_price, 0),
         coalesce(c.line_production_cost, 0),
         oi.line_net - coalesce(c.line_production_cost, 0),
         coalesce(c.cost_missing, true)
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.order_item_costs c on c.order_item_id = oi.id
  where o.payment_status = 'paid'
    and o.status <> 'cancelled'
    and o.created_at >= p_from
    and o.created_at <  p_to
    and (p_product_id is null or oi.product_id = p_product_id)
  order by o.created_at desc, o.order_number desc, oi.created_at;
end;
$$;

-- KPIs. Con filtro de producto, el envío no es atribuible → shipping_revenue = 0.
create or replace function public.admin_sales_summary(
  p_from        timestamptz,
  p_to          timestamptz,
  p_product_id  uuid default null
)
returns table (
  orders_count      bigint,
  units_sold        bigint,
  gross_revenue     numeric,   -- productos, importe cobrado (con IVA si aplica)
  vat_collected     numeric,   -- IVA de productos
  net_revenue       numeric,   -- productos sin IVA
  production_costs  numeric,
  net_profit        numeric,   -- net_revenue − production_costs
  shipping_revenue  numeric,   -- envío cobrado (con IVA si aplica)
  lines_cost_missing bigint    -- líneas vendidas sin coste registrado (alerta)
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
  with r as (
    select * from public.admin_sales_report(p_from, p_to, p_product_id)
  )
  select count(distinct r.order_id),
         coalesce(sum(r.quantity), 0)::bigint,
         coalesce(sum(r.line_total), 0),
         coalesce(sum(r.line_tax), 0),
         coalesce(sum(r.line_net), 0),
         coalesce(sum(r.line_production_cost), 0),
         coalesce(sum(r.line_net), 0) - coalesce(sum(r.line_production_cost), 0),
         case when p_product_id is null then (
           select coalesce(sum(o.shipping_amount), 0)
           from public.orders o
           where o.payment_status = 'paid' and o.status <> 'cancelled'
             and o.created_at >= p_from and o.created_at < p_to
         ) else 0 end,
         count(*) filter (where r.cost_missing)
  from r;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientes registrados con historial agregado
-- -----------------------------------------------------------------------------
create or replace function public.admin_customers_overview()
returns table (
  user_id            uuid,
  email              text,
  full_name          text,
  phone              text,
  preferred_locale   public.locale_code,
  registered_at      timestamptz,
  orders_count       bigint,
  total_spent        numeric,
  last_order_at      timestamptz,
  newsletter_status  text
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
  select p.id, p.email, p.full_name, p.phone, p.preferred_locale, p.created_at,
         coalesce(agg.orders_count, 0),
         coalesce(agg.total_spent, 0),
         agg.last_order_at,
         coalesce(ns.status, 'none')
  from public.profiles p
  left join lateral (
    select count(*) as orders_count, sum(o.total) as total_spent, max(o.created_at) as last_order_at
    from public.orders o
    where o.user_id = p.id and o.payment_status = 'paid' and o.status <> 'cancelled'
  ) agg on true
  left join lateral (
    select s.status
    from public.newsletter_subscribers s
    where s.user_id = p.id or s.email = p.email
    order by (s.user_id = p.id) desc nulls last, s.updated_at desc
    limit 1
  ) ns on true
  where p.role = 'customer'
  order by p.created_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audiencia de campaña (solo suscriptores confirmados)
-- -----------------------------------------------------------------------------
create or replace function public.admin_campaign_audience(p_segment jsonb)
returns table (
  subscriber_id      uuid,
  email              text,
  locale             public.locale_code,
  unsubscribe_token  uuid
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
  if not public.is_valid_campaign_segment(p_segment) then
    raise exception 'invalid segment' using errcode = '22023';
  end if;

  return query
  select s.id, s.email, s.locale, s.unsubscribe_token
  from public.newsletter_subscribers s
  where s.status = 'subscribed'
    and (not (p_segment ? 'locales')
         or s.locale::text in (select jsonb_array_elements_text(p_segment -> 'locales')))
    and case p_segment ->> 'type'
          when 'all_subscribers' then true
          when 'customers' then s.user_id is not null
          when 'customers_with_orders' then exists (
            select 1 from public.orders o
            where (o.user_id = s.user_id or o.email = s.email) and o.payment_status = 'paid')
          when 'customers_without_orders' then s.user_id is not null and not exists (
            select 1 from public.orders o
            where (o.user_id = s.user_id or o.email = s.email) and o.payment_status = 'paid')
          else false
        end
  order by s.email;
end;
$$;

-- -----------------------------------------------------------------------------
-- Suscripción a newsletter del cliente autenticado (email verificado por Auth)
-- -----------------------------------------------------------------------------
create or replace function public.set_my_newsletter_subscription(
  p_subscribed  boolean,
  p_locale      public.locale_code default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_locale  public.locale_code;
  v_status  text := case when p_subscribed then 'subscribed' else 'unsubscribed' end;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.email, p.preferred_locale into v_email, v_locale
  from public.profiles p where p.id = v_uid;

  insert into public.newsletter_subscribers (email, user_id, locale, status, source, confirmed_at, unsubscribed_at)
  values (v_email, v_uid, coalesce(p_locale, v_locale), v_status, 'account',
          case when p_subscribed then now() end,
          case when not p_subscribed then now() end)
  on conflict (email) do update
     set user_id         = excluded.user_id,
         locale          = excluded.locale,
         status          = excluded.status,
         confirmed_at    = case when p_subscribed
                                then coalesce(public.newsletter_subscribers.confirmed_at, now())
                                else public.newsletter_subscribers.confirmed_at end,
         unsubscribed_at = case when p_subscribed then null else now() end;

  return v_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- Productos con stock bajo (dashboard admin)
-- -----------------------------------------------------------------------------
create or replace function public.admin_low_stock_products()
returns table (product_id uuid, name jsonb, stock integer, is_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.stock, p.is_active
  from public.products p
  where public.is_admin_or_service()
    and p.stock <= (select s.low_stock_threshold from public.store_settings s where s.id = 1)
  order by p.stock asc, p.updated_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
-- Supabase concede EXECUTE a PUBLIC por defecto: lo revocamos y concedemos explícitamente.
revoke execute on function public.finalize_checkout(text, text, text, text, text, jsonb, jsonb, numeric, text, text, public.payment_status) from public, anon, authenticated;
grant  execute on function public.finalize_checkout(text, text, text, text, text, jsonb, jsonb, numeric, text, text, public.payment_status) to service_role;

revoke execute on function public.admin_set_order_status(uuid, public.order_status, text, boolean) from public, anon;
revoke execute on function public.admin_sales_report(timestamptz, timestamptz, uuid)              from public, anon;
revoke execute on function public.admin_sales_summary(timestamptz, timestamptz, uuid)             from public, anon;
revoke execute on function public.admin_customers_overview()                                      from public, anon;
revoke execute on function public.admin_campaign_audience(jsonb)                                  from public, anon;
revoke execute on function public.admin_low_stock_products()                                      from public, anon;
revoke execute on function public.set_my_newsletter_subscription(boolean, public.locale_code)     from public, anon;

grant execute on function public.admin_set_order_status(uuid, public.order_status, text, boolean) to authenticated, service_role;
grant execute on function public.admin_sales_report(timestamptz, timestamptz, uuid)              to authenticated, service_role;
grant execute on function public.admin_sales_summary(timestamptz, timestamptz, uuid)             to authenticated, service_role;
grant execute on function public.admin_customers_overview()                                      to authenticated, service_role;
grant execute on function public.admin_campaign_audience(jsonb)                                  to authenticated, service_role;
grant execute on function public.admin_low_stock_products()                                      to authenticated, service_role;
grant execute on function public.set_my_newsletter_subscription(boolean, public.locale_code)     to authenticated;

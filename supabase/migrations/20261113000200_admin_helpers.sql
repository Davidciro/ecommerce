-- =============================================================================
-- 20261113000200 · Helpers del panel admin (Fase 3)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reordenar imágenes de un producto en una sola transacción.
-- La UNIQUE (product_id, position) es DEFERRABLE INITIALLY DEFERRED, por lo que
-- los intercambios intermedios no fallan; se valida al final de la transacción.
-- p_image_ids: ids en el orden deseado (posición 0, 1, 2).
-- -----------------------------------------------------------------------------
create or replace function public.admin_reorder_product_images(
  p_product_id uuid,
  p_image_ids  uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if cardinality(p_image_ids) > 3 then
    raise exception 'max 3 images' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.product_images
  where product_id = p_product_id and id = any (p_image_ids);

  if v_count <> cardinality(p_image_ids)
     or v_count <> (select count(*) from public.product_images where product_id = p_product_id) then
    raise exception 'image list does not match product images' using errcode = '22023';
  end if;

  update public.product_images pi
     set position = (x.ord - 1)::smallint
    from unnest(p_image_ids) with ordinality as x(id, ord)
   where pi.id = x.id and pi.product_id = p_product_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contadores del dashboard en una sola llamada
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns table (
  pending_orders       bigint,
  in_progress_orders   bigint,
  needs_review_orders  bigint,
  unhandled_messages   bigint,
  low_stock_products   bigint,
  active_products      bigint,
  customers            bigint,
  subscribers          bigint
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
  select
    (select count(*) from public.orders o where o.status = 'pending'),
    (select count(*) from public.orders o where o.status = 'in_progress'),
    (select count(*) from public.orders o where o.needs_review and o.status <> 'cancelled'),
    (select count(*) from public.contact_messages m where not m.is_handled),
    (select count(*) from public.products p
      where p.is_active
        and p.stock <= (select s.low_stock_threshold from public.store_settings s where s.id = 1)),
    (select count(*) from public.products p where p.is_active),
    (select count(*) from public.profiles pr where pr.role = 'customer'),
    (select count(*) from public.newsletter_subscribers ns where ns.status = 'subscribed');
end;
$$;

revoke execute on function public.admin_reorder_product_images(uuid, uuid[]) from public, anon;
revoke execute on function public.admin_dashboard_stats()                     from public, anon;
grant  execute on function public.admin_reorder_product_images(uuid, uuid[]) to authenticated, service_role;
grant  execute on function public.admin_dashboard_stats()                     to authenticated, service_role;

-- =============================================================================
-- 0800 · Supabase Storage: buckets y políticas
-- -----------------------------------------------------------------------------
-- product-images: público (lectura por URL pública/CDN), máx. 2 MB, solo raster.
--   Convención de ruta: products/<product_id>/<uuid>.webp
--   La optimización (resize ≤ 1600px + WebP) se hace en el cliente admin antes de
--   subir; además el frontend puede usar Image Transformations de Supabase.
-- site-assets: imágenes del CMS (OG images, fotos "Quiénes somos"), máx. 5 MB.
-- SVG excluido a propósito (vector de XSS si se sirve desde el mismo origen).
--
-- No se crea política SELECT pública: los buckets públicos sirven archivos por URL
-- sin ella, y así se impide listar el bucket (p. ej. imágenes de productos inactivos).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 2097152,
     array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-assets',    'site-assets',    true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "storage: admin reads store buckets"
  on storage.objects for select to authenticated
  using (bucket_id in ('product-images', 'site-assets') and (select public.is_admin()));

create policy "storage: admin uploads to store buckets"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'site-assets') and (select public.is_admin()));

create policy "storage: admin updates store buckets"
  on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'site-assets') and (select public.is_admin()))
  with check (bucket_id in ('product-images', 'site-assets') and (select public.is_admin()));

create policy "storage: admin deletes from store buckets"
  on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'site-assets') and (select public.is_admin()));

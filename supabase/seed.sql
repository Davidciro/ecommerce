-- =============================================================================
-- seed.sql · Datos iniciales (idempotente)
-- -----------------------------------------------------------------------------
-- Crea la configuración base, la fila de secretos vacía, las secciones CMS y las
-- entradas SEO de las páginas públicas. Los textos quedan vacíos para que el
-- dueño los complete desde el panel admin en ES / FR / DE.
--
-- ALTA DEL ADMINISTRADOR (no existe registro público de admins):
--   1. Supabase Dashboard → Authentication → Users → "Add user" (email + contraseña,
--      marcar "Auto Confirm User").
--   2. Ejecutar en el SQL Editor:
--        update public.profiles set role = 'admin' where email = lower('owner@example.ch');
--   3. El trigger sync_role_to_auth replica el rol en app_metadata (claim del JWT).
-- =============================================================================

insert into public.store_settings (id) values (1) on conflict (id) do nothing;
insert into public.store_secrets  (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Secciones CMS
-- -----------------------------------------------------------------------------
insert into public.site_sections (key, page, sort_order, content, settings) values
  -- Global
  ('global.header', 'global', 0,
     jsonb_build_object('tagline', public.empty_localized()),
     '{}'::jsonb),
  ('global.footer', 'global', 1,
     jsonb_build_object('about_text', public.empty_localized(), 'copyright', public.empty_localized()),
     '{"social": {"instagram": "", "facebook": ""}}'::jsonb),
  ('global.cookie_banner', 'global', 2,
     jsonb_build_object('title', public.empty_localized(), 'body', public.empty_localized(),
                        'accept_label', public.empty_localized(), 'reject_label', public.empty_localized(),
                        'settings_label', public.empty_localized()),
     '{"policy_version": 1}'::jsonb),

  -- Inicio
  ('home.hero', 'home', 0,
     jsonb_build_object('title', public.empty_localized(), 'intro', public.empty_localized(),
                        'cta_label', public.empty_localized()),
     '{"hero_image_path": null}'::jsonb),
  ('home.featured', 'home', 1,
     jsonb_build_object('title', public.empty_localized(), 'subtitle', public.empty_localized()),
     '{"max_items": 8}'::jsonb),

  -- Quiénes somos
  ('about.story', 'about', 0,
     jsonb_build_object('title', public.empty_localized(),
                        'history', public.empty_localized(),
                        'what_we_do', public.empty_localized(),
                        'why_we_do_it', public.empty_localized()),
     '{"since_year": null, "image_path": null}'::jsonb),
  ('about.location', 'about', 1,
     jsonb_build_object('title', public.empty_localized(), 'opening_hours', public.empty_localized(),
                        'directions', public.empty_localized()),
     '{"street": "", "postal_code": "", "city": "", "country": "CH",
       "latitude": null, "longitude": null, "map_embed_url": "", "map_link_url": ""}'::jsonb),
  ('about.contact', 'about', 2,
     jsonb_build_object('title', public.empty_localized(), 'intro', public.empty_localized()),
     '{"contact_person": "", "phones": [], "email": "", "show_form": true}'::jsonb),

  -- Productos
  ('products.header', 'products', 0,
     jsonb_build_object('title', public.empty_localized(), 'intro', public.empty_localized()),
     '{}'::jsonb),

  -- Legales (Suiza / UE)
  ('legal.impressum', 'legal', 0,
     jsonb_build_object('title', public.empty_localized(), 'body', public.empty_localized()),
     '{}'::jsonb),
  ('legal.privacy', 'legal', 1,
     jsonb_build_object('title', public.empty_localized(), 'body', public.empty_localized()),
     '{"last_updated": null}'::jsonb),
  ('legal.terms', 'legal', 2,
     jsonb_build_object('title', public.empty_localized(), 'body', public.empty_localized()),
     '{"last_updated": null}'::jsonb),
  ('legal.cookies', 'legal', 3,
     jsonb_build_object('title', public.empty_localized(), 'body', public.empty_localized()),
     '{"last_updated": null}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- SEO por página
-- -----------------------------------------------------------------------------
insert into public.seo_pages (page_key, route_path, sitemap_priority, sitemap_changefreq, noindex) values
  ('home',            '/',                1.0, 'weekly',  false),
  ('products',        '/products',        0.9, 'daily',   false),
  ('about',           '/about',           0.7, 'monthly', false),
  ('legal_impressum', '/legal/impressum', 0.2, 'yearly',  false),
  ('legal_privacy',   '/legal/privacy',   0.2, 'yearly',  false),
  ('legal_terms',     '/legal/terms',     0.2, 'yearly',  false),
  ('legal_cookies',   '/legal/cookies',   0.1, 'yearly',  false)
on conflict (page_key) do nothing;

# Arquitectura — E-commerce CH/EU (Nuxt 3 + Supabase + Stripe + Resend)

## 1. Estructura de carpetas

```
ecommerce/
├── assets/css/                    # main.css (Tailwind layers, tokens)
├── components/
│   ├── ui/                        # Botón, Input, Modal, Badge, QuantitySelector… (accesibles, sin lógica de negocio)
│   ├── layout/                    # AppHeader, AppFooter, LocaleSwitcher, CookieBanner
│   ├── product/                   # ProductCard, ProductGrid, ProductDetailModal, ProductGallery
│   ├── cart/                      # CartDrawer, CartLine, CartSummary
│   ├── account/                   # OrderList, OrderStatusTimeline, NewsletterToggle
│   ├── legal/                     # LegalPage (render de site_sections legal.*)
│   └── admin/
│       ├── products/              # ProductForm, LocalizedField, ImageUploader (≤3, compresión WebP)
│       ├── cms/                   # SectionEditor (content localizado + settings)
│       ├── seo/                   # SeoPageForm, KeywordsInput
│       ├── orders/                # OrdersTable, OrderDetail, StatusChanger
│       ├── reports/               # KpiCards, SalesTable, DateRangeFilter, CsvExportButton
│       ├── campaigns/             # CampaignForm, SegmentPicker, CampaignHistory
│       └── settings/              # StoreSettingsForm, StripeKeysForm (write-only)
├── composables/                   # useLocalized(), useCart(), useStoreSettings(), useSeoPage(), useMoney()
├── layouts/                       # default.vue, admin.vue, auth.vue
├── middleware/                    # admin.ts (rol admin), auth.ts (cliente logueado)
├── pages/                         # (i18n añade /es /fr /de automáticamente)
│   ├── index.vue                  # Inicio: H1 + intro CMS + destacados
│   ├── about.vue                  # Quiénes somos + LocalBusiness JSON-LD
│   ├── products/index.vue         # Catálogo con búsqueda/filtros
│   ├── products/[slug].vue        # Página de producto indexable (Product JSON-LD)
│   ├── legal/[page].vue           # impressum | privacy | terms | cookies
│   ├── checkout/success.vue, cancel.vue
│   ├── auth/login.vue, register.vue, callback.vue (OAuth Google)
│   ├── account/index.vue, account/orders/[id].vue
│   └── admin/                     # index (dashboard), products, cms, seo, orders, customers,
│                                  # reports, campaigns, settings, messages
├── plugins/                       # p. ej. cart-persist.client.ts
├── stores/                        # Pinia: cart.ts (persistido en localStorage, solo ids + cantidades)
├── utils/                         # money.ts, localized.ts, slug.ts (compartidos cliente/servidor)
├── types/                         # database.types.ts (generado con `supabase gen types`)
├── i18n/locales/                  # es.json, fr.json, de.json (textos de UI fijos)
├── public/                        # favicon, imágenes estáticas
├── server/
│   ├── api/
│   │   ├── checkout/              # POST /api/checkout  → precios desde BD, draft, Stripe Session
│   │   ├── webhooks/              # POST /api/webhooks/stripe → finalize_checkout + email
│   │   ├── contact/               # POST /api/contact (rate limit + honeypot)
│   │   ├── newsletter/            # subscribe (doble opt-in), confirm, unsubscribe
│   │   ├── account/               # endpoints del cliente si se requieren
│   │   └── admin/                 # orders/status (RPC + email), campaigns/send, settings/stripe,
│   │                              # reports/export.csv — todos verifican rol admin en servidor
│   ├── routes/                    # sitemap.xml.ts, robots.txt.ts
│   ├── middleware/                # cabeceras de seguridad (CSP, HSTS…)
│   ├── emails/templates/          # plantillas HTML por idioma (confirmación, estado, opt-in)
│   └── utils/                     # supabaseAdmin(), requireAdmin(event), getStripe() (lee store_secrets),
│                                  # pricing.ts (cálculo IVA/envío), resend.ts
├── supabase/
│   ├── migrations/                # 0100…0800 (ver §2)
│   └── seed.sql                   # settings, secciones CMS, páginas SEO
├── docs/ARCHITECTURE.md
├── .env.example
└── nuxt.config.ts / package.json / tailwind.config.ts   (Fase 2)
```

## 2. Migraciones

| Archivo | Contenido |
|---|---|
| `0100_extensions_types_helpers` | enums (`app_role`, `locale_code`, `currency_code`, `order_status`, `payment_status`), validadores JSONB `{es,fr,de}`, trigger `set_updated_at` |
| `0200_profiles_auth_roles` | `profiles`, `is_admin()`, `is_service_role()`, alta automática de perfil, sincronización de rol → `app_metadata` |
| `0300_catalog` | `products` (JSONB localizado, slug único por idioma, búsqueda FTS), `product_images` (≤3), `product_costs` (solo admin) |
| `0400_cms_seo_settings` | `site_sections`, `seo_pages`, `store_settings` (público), `store_secrets` (solo service_role) + RPC write-only |
| `0500_orders` | `checkout_drafts`, `orders`, `order_items`, `order_item_costs`, `order_status_history`, `order_notes`, `stripe_events` |
| `0600_marketing_contact` | `newsletter_subscribers`, `email_campaigns`, `email_campaign_recipients`, `email_logs`, `contact_messages` |
| `0700_rpc_functions` | `finalize_checkout`, `admin_set_order_status`, `admin_sales_report/summary`, `admin_customers_overview`, `admin_campaign_audience`, `set_my_newsletter_subscription`, `admin_low_stock_products` |
| `0800_storage` | buckets `product-images` (2 MB) y `site-assets` (5 MB) + políticas admin |

## 3. Matriz de acceso

| Tabla | anon | cliente | admin | service_role |
|---|---|---|---|---|
| products / product_images | R (activos) | R (activos) | CRUD | ✔ |
| **product_costs** | ✖ | ✖ | CRUD | ✔ |
| site_sections | R (publicadas) | R | CRUD | ✔ |
| seo_pages, store_settings | R | R | CRUD / U | ✔ |
| **store_secrets** | ✖ | ✖ | solo RPC write-only + estado enmascarado | ✔ |
| checkout_drafts, stripe_events | ✖ | ✖ | ✖ | ✔ |
| orders | ✖ | R (propios) | R + U (solo carrier/tracking); estado vía RPC | ✔ |
| order_items, order_status_history | ✖ | R (propios) | R | ✔ |
| **order_item_costs**, order_notes | ✖ | ✖ | R / CRUD | ✔ |
| profiles | ✖ | R/U propio (sin `role`/`email`) | R | ✔ |
| newsletter_subscribers | ✖ | R propio, cambio vía RPC | CRUD | ✔ |
| campañas, email_logs, contact_messages | ✖ | ✖ | CRUD / R | ✔ |

## 4. Decisiones de diseño

1. **Rol admin**: fuente de verdad `profiles.role`; nadie puede auto-promoverse (privilegios por columna). Se replica en `app_metadata.role` solo como ayuda para la UI; RLS nunca confía en el JWT para el rol.
2. **Márgenes**: `production_price` vive en `product_costs`; en cada venta se congela una copia en `order_item_costs` (también solo admin) para que los reportes históricos no cambien si el coste se edita después.
3. **Checkout seguro**: `/api/checkout` lee precios de BD y guarda un `checkout_draft` con el snapshot exacto cobrado. El webhook no confía en metadata de Stripe para importes: usa el draft y compara con `amount_total`.
4. **Stock atómico**: `finalize_checkout` bloquea filas en orden determinista y descuenta todo-o-nada. Si no hay stock (venta concurrente durante el pago), el pedido se crea igualmente con `needs_review = true` porque el cliente ya pagó; el admin decide reembolso o reposición. Idempotente ante reintentos de Stripe.
5. **IVA**: por defecto `prices_include_vat = true` (B2C suizo). Cada línea guarda `line_total`, `line_tax`, `line_net`; la ganancia neta se calcula sobre importes **sin IVA**.
6. **TWINT** solo admite CHF → restricción CHECK en `store_settings`. Apple Pay / Google Pay se habilitan vía `card` + verificación de dominio en Stripe.
7. **Secretos de Stripe**: tabla `store_secrets` sin políticas RLS y con privilegios revocados; solo el servidor (service role) la lee. Mejora opcional futura: migrar a Supabase Vault para cifrado en reposo.
8. **Newsletter**: campañas solo a `status = 'subscribed'` (doble opt-in para altas anónimas), con `unsubscribe_token` por destinatario.

## 5. Puesta en marcha de la base de datos

```bash
npx supabase init            # si aún no existe supabase/config.toml
npx supabase link --project-ref <ref>
npx supabase db push         # aplica supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # o: npx supabase db reset (en local aplica seed automáticamente)
npx supabase gen types typescript --linked > types/database.types.ts
```

Crear el administrador: ver cabecera de `supabase/seed.sql`.

## 6. Autenticación, roles e i18n (Fase 2)

### Rutas
Todas las rutas llevan prefijo de idioma (`/fr` por defecto, `/de`, `/es`). `/` redirige al idioma
del navegador (cookie `i18n_locale`), con `fr` como respaldo.

| Ruta | Acceso | Middleware |
|---|---|---|
| `/:locale/auth/login`, `/register`, `/forgot-password` | solo visitantes | `guest` |
| `/:locale/auth/callback` | público (OAuth, confirmación de email, recuperación) | — |
| `/:locale/auth/reset-password` | requiere sesión (de recuperación o normal) | — |
| `/:locale/account` | cliente o admin con sesión | `auth` |
| `/:locale/admin/login` | solo visitantes; rechaza cuentas sin rol admin | `guest` |
| `/:locale/admin/**` | solo `role = 'admin'` (403 si no) | `admin` |
| `/api/admin/**` | solo admin, verificado en servidor | `server/middleware/admin-api-guard.ts` |

### Capas de autorización
1. **UI**: `useAuth().isAdmin` (solo para mostrar u ocultar elementos).
2. **Rutas**: los middlewares `auth` y `admin` (SSR y cliente) leen el rol desde `profiles`.
3. **API**: `requireUser()` / `requireAdmin()` en `server/utils/supabase.ts`, más el guard global de `/api/admin/**`.
4. **Datos**: las políticas RLS de Postgres. Es la única capa que no puede saltarse.

### Configuración necesaria en el Dashboard de Supabase
1. **Authentication → URL Configuration**
   - *Site URL*: la URL de producción, por ejemplo `https://www.tu-tienda.ch`.
   - *Redirect URLs*: `http://localhost:3000/**` y `https://www.tu-tienda.ch/**`.
2. **Authentication → Sign In / Providers → Google**: activar el proveedor con el *Client ID* y el
   *Client Secret* de Google Cloud Console (OAuth 2.0, tipo "Web application"). En Google, el
   *Authorized redirect URI* es `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Authentication → Sign In / Providers → Email**: dejar activado "Confirm email". Recomendado:
   longitud mínima de contraseña 8.
4. **Authentication → Emails → Templates** (opcional): las plantillas pueden usar
   `{{ .Data.locale }}` (fr/de/es, guardado al registrarse) para mostrar el texto en el idioma del cliente.
5. **SMTP** (producción): configurar un SMTP propio. Resend ofrece SMTP compatible.
   El SMTP integrado de Supabase tiene límites muy bajos de envío.

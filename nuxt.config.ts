// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

const DEFAULT_LOCALE = 'fr' as const

export default defineNuxtConfig({
  compatibilityDate: '2026-11-12',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/i18n',
    // Fase 4: '@pinia/nuxt' (carrito persistente)
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },

  // ---------------------------------------------------------------------------
  // Supabase — conexión
  //   NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY  (navegador + servidor)
  //   NUXT_SUPABASE_SECRET_KEY                              (SOLO servidor)
  // ---------------------------------------------------------------------------
  supabase: {
    // La tienda es pública: sin redirección global. /account y /admin se protegen
    // con los middlewares `auth` y `admin` (middleware/).
    redirect: false,
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: ['/*'],
    },
    types: '~/types/database.types.ts',
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },

  // ---------------------------------------------------------------------------
  // i18n — es / fr / de con prefijo obligatorio (/fr, /de, /es)
  // ---------------------------------------------------------------------------
  i18n: {
    strategy: 'prefix',
    defaultLocale: DEFAULT_LOCALE,
    // `language` alimenta <html lang> y los hreflang (mercado suizo: fr-CH / de-CH)
    locales: [
      { code: 'fr', language: 'fr-CH', name: 'Français', file: 'fr.json' },
      { code: 'de', language: 'de-CH', name: 'Deutsch', file: 'de.json' },
      { code: 'es', language: 'es', name: 'Español', file: 'es.json' },
    ],
    // Archivos en i18n/locales/*.json ; opciones de vue-i18n en i18n/i18n.config.ts
    langDir: 'locales',
    vueI18n: './i18n.config.ts',
    // URL absoluta para hreflang / canonical / og:url
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root', // solo "/" redirige al idioma del navegador (mejor para SEO)
      fallbackLocale: DEFAULT_LOCALE,
    },
  },

  runtimeConfig: {
    // Solo servidor (sobrescribibles con NUXT_*)
    resendApiKey: '',           // NUXT_RESEND_API_KEY
    resendFromEmail: '',        // NUXT_RESEND_FROM_EMAIL
    adminNotificationEmail: '', // NUXT_ADMIN_NOTIFICATION_EMAIL
    public: {
      siteUrl: 'http://localhost:3000', // NUXT_PUBLIC_SITE_URL
      defaultLocale: DEFAULT_LOCALE,    // NUXT_PUBLIC_DEFAULT_LOCALE
    },
  },

  // Cabeceras de áreas privadas (noindex / no-store): server/middleware/private-headers.ts

  typescript: {
    strict: true,
  },
})

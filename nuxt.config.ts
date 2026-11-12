// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-12',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/supabase',
    // Fase 2: '@nuxtjs/i18n', '@nuxtjs/tailwindcss', '@pinia/nuxt'
  ],

  // ---------------------------------------------------------------------------
  // Supabase — conexión
  // Credenciales leídas de .env (ver .env.example):
  //   NUXT_PUBLIC_SUPABASE_URL   → runtimeConfig.public.supabase.url   (navegador + servidor)
  //   NUXT_PUBLIC_SUPABASE_KEY   → runtimeConfig.public.supabase.key   (publishable / anon)
  //   NUXT_SUPABASE_SECRET_KEY   → runtimeConfig.supabase.secretKey    (SOLO servidor)
  // ---------------------------------------------------------------------------
  supabase: {
    // La tienda es pública: desactivamos la redirección global a /login del módulo.
    // La protección de /account y /admin se hace con middleware propio (Fase 2).
    redirect: false,
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: ['/*'],
    },
    // Generado con `npm run db:types` tras enlazar el proyecto Supabase.
    types: '~/types/database.types.ts',
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },

  runtimeConfig: {
    // Solo servidor (sobrescribibles con NUXT_*)
    resendApiKey: '',          // NUXT_RESEND_API_KEY
    resendFromEmail: '',       // NUXT_RESEND_FROM_EMAIL
    adminNotificationEmail: '', // NUXT_ADMIN_NOTIFICATION_EMAIL
    public: {
      siteUrl: 'http://localhost:3000', // NUXT_PUBLIC_SITE_URL
      defaultLocale: 'de',              // NUXT_PUBLIC_DEFAULT_LOCALE
    },
  },

  typescript: {
    strict: true,
  },
})

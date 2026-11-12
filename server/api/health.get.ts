/**
 * GET /api/health — verifica la conexión con Supabase.
 * Lee store_settings con el cliente público (RLS: lectura pública) y comprueba
 * que la secret key del servidor está configurada, sin exponer ningún dato sensible.
 */
export default defineEventHandler(async (event) => {
  const startedAt = Date.now()

  const { url, key } = useRuntimeConfig(event).public.supabase ?? {}
  if (!url || !key) {
    setResponseStatus(event, 503)
    return {
      ok: false,
      supabase: 'not_configured',
      message: 'Define NUXT_PUBLIC_SUPABASE_URL y NUXT_PUBLIC_SUPABASE_KEY en .env',
    }
  }

  const client = await useServerSupabase(event)

  const { data, error } = await client
    .from('store_settings')
    .select('store_name, currency, default_locale')
    .eq('id', 1)
    .maybeSingle()

  const config = useRuntimeConfig(event)
  const hasServerKey = Boolean(config.supabase?.secretKey || config.supabase?.serviceKey)

  if (error) {
    setResponseStatus(event, 503)
    return {
      ok: false,
      supabase: 'error',
      // El código de PostgREST ayuda a diagnosticar (p. ej. 42P01 = migraciones no aplicadas)
      code: error.code,
      message: error.message,
      serverKeyConfigured: hasServerKey,
    }
  }

  return {
    ok: true,
    supabase: 'connected',
    schemaSeeded: data !== null,
    store: data,
    serverKeyConfigured: hasServerKey,
    latencyMs: Date.now() - startedAt,
  }
})

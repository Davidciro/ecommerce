import type { Database } from '~/types/database.types'

export type PublicStoreSettings = Pick<
  Database['public']['Tables']['store_settings']['Row'],
  'store_name' | 'currency' | 'default_locale' | 'contact_email'
>

/** Configuración pública de la tienda (lectura anónima permitida por RLS). Cacheada por request/sesión. */
export function useStoreSettings() {
  const supabase = useSupabaseClient<Database>()
  return useAsyncData(
    'store-settings',
    async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('store_name, currency, default_locale, contact_email')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    {
      getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    },
  )
}

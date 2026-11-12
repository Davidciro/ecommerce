/**
 * Proveedores de login activos en Supabase (endpoint público /auth/v1/settings).
 * Permite ocultar "Continuar con Google" si el proveedor no está habilitado en el Dashboard.
 */
export function useAuthProviders() {
  const { url, key } = useRuntimeConfig().public.supabase

  return useAsyncData(
    'auth:providers',
    async () => {
      try {
        const settings = await $fetch<{ external?: Record<string, boolean> }>(`${url}/auth/v1/settings`, {
          headers: { apikey: key },
          timeout: 5000,
        })
        return { google: settings.external?.google === true }
      }
      catch {
        return { google: false }
      }
    },
    {
      default: () => ({ google: false }),
      getCachedData: (k, nuxtApp) => nuxtApp.payload.data[k] ?? nuxtApp.static.data[k],
    },
  )
}

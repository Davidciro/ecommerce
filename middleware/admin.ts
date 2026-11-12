/**
 * Protege el panel /admin. Uso: definePageMeta({ middleware: 'admin' })
 *
 *  - Sin sesión            → /admin/login?redirect=...
 *  - Con sesión, no admin  → error 403
 *  - Admin                 → continúa
 *
 * El rol se lee de public.profiles (fuente de verdad), no del claim del JWT.
 * Esto es control de UI: los datos siguen protegidos por RLS y por el
 * middleware de servidor de /api/admin/**.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const localePath = useLocalePath()

  if (!user.value) {
    return navigateTo({ path: localePath('/admin/login'), query: { redirect: to.fullPath } })
  }

  const { fetchProfile } = useAuth()
  let isAdmin = false
  try {
    const profile = await fetchProfile()
    isAdmin = profile?.role === 'admin'
  }
  catch {
    isAdmin = false
  }

  if (!isAdmin) {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }
})

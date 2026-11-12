/**
 * Páginas solo para visitantes (login, registro, recuperar contraseña).
 * Si ya hay sesión, redirige al destino solicitado o a la cuenta/panel.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  if (!user.value) return

  const localePath = useLocalePath()
  const { fetchProfile } = useAuth()
  const profile = await fetchProfile().catch(() => null)
  const fallback = profile?.role === 'admin' ? localePath('/admin') : localePath('/account')

  return navigateTo(safeRedirect(to.query.redirect, fallback))
})

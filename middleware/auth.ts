/**
 * Requiere sesión iniciada (cliente o admin). Uso: definePageMeta({ middleware: 'auth' })
 * Funciona en SSR y en cliente: useSupabaseUser se rellena desde las cookies en el servidor.
 */
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  if (user.value) return

  const localePath = useLocalePath()
  return navigateTo({ path: localePath('/auth/login'), query: { redirect: to.fullPath } })
})

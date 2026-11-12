/**
 * Defensa en profundidad: toda ruta /api/admin/** exige rol admin en el servidor,
 * aunque el endpoint olvide llamar a requireAdmin(). Se ejecuta antes de los handlers.
 */
export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? ''
  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    event.context.adminClaims = await requireAdmin(event)
  }
})

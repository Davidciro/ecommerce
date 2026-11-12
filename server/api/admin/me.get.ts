/**
 * GET /api/admin/me — comprueba la sesión de administrador.
 * Protegido por server/middleware/admin-api-guard.ts (401 sin sesión, 403 si no es admin).
 */
export default defineEventHandler((event) => {
  const claims = event.context.adminClaims as { sub: string, email?: string } | undefined
  return { ok: true, userId: claims?.sub ?? null, email: claims?.email ?? null, role: 'admin' }
})

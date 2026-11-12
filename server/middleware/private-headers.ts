/**
 * Áreas privadas (/:locale/admin, /:locale/account, /:locale/auth) y la API:
 * nunca indexar ni cachear en CDN/navegador (contienen datos personales o sesión).
 * También añade cabeceras de seguridad básicas a todas las respuestas.
 */
const PRIVATE_PAGE = /^\/(?:fr|de|es)\/(?:admin|account|auth)(?:\/|$)/

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0] ?? ''

  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })

  if (PRIVATE_PAGE.test(path)) {
    setResponseHeaders(event, { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' })
  }
  else if (path.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
  }
})

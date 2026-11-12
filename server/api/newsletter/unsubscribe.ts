/**
 * GET|POST /api/newsletter/unsubscribe?token=<uuid>
 *  - GET: enlace del pie del email → da de baja y redirige a la portada en su idioma.
 *  - POST: "List-Unsubscribe-Post: One-Click" (RFC 8058) de Gmail/Yahoo → 200.
 */
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const method = event.method
  if (method !== 'GET' && method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const token = getQuery(event).token
  const parsed = z.uuid().safeParse(token)
  const locale = { value: 'fr' }

  if (parsed.success) {
    const { data } = await useSupabaseAdmin(event)
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', parsed.data)
      .neq('status', 'unsubscribed')
      .select('locale')
      .maybeSingle()
    if (data?.locale) locale.value = data.locale
  }

  if (method === 'POST') return { ok: true }
  // Misma respuesta exista o no el token (no revela suscriptores)
  return sendRedirect(event, `/${locale.value}?newsletter=unsubscribed`, 303)
})

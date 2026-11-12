/**
 * POST /api/admin/campaigns/:id/test — envía una prueba al email del admin en el idioma elegido.
 */
import { z } from 'zod'

const Body = z.object({ locale: z.enum(['fr', 'de', 'es']).default('fr') })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !z.uuid().safeParse(id).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid campaign id' })
  }
  const { locale } = await readValidatedBody(event, Body.parse)
  if (!isEmailConfigured(event)) {
    throw createError({ statusCode: 409, statusMessage: 'resend_not_configured' })
  }

  const claims = event.context.adminClaims as { email?: string } | undefined
  if (!claims?.email) throw createError({ statusCode: 400, statusMessage: 'admin_email_unknown' })

  const campaign = await loadCampaign(event, id)
  const ctx = await campaignContext(event)
  const msg = buildCampaignMessage(
    campaignContent(campaign),
    { email: claims.email, locale, unsubscribe_token: '00000000-0000-0000-0000-000000000000' },
    ctx,
    id,
  )
  if (!msg) throw createError({ statusCode: 422, statusMessage: 'campaign_empty' })

  const result = await sendEmail(event, { ...msg, subject: `[TEST] ${msg.subject}` })
  return { ok: !result.error, to: claims.email, error: result.error }
})

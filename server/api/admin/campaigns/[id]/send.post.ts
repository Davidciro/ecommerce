/**
 * POST /api/admin/campaigns/:id/send — envía una campaña en borrador a su segmento.
 * Solo suscriptores confirmados (admin_campaign_audience). Lotes de 100 vía Resend.
 *
 * Nota de escala: el envío es síncrono dentro de la petición. Para audiencias de
 * varios miles conviene moverlo a una cola / Supabase Edge Function programada.
 */
import { z } from 'zod'

const CHUNK = 100

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !z.uuid().safeParse(id).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid campaign id' })
  }
  if (!isEmailConfigured(event)) {
    throw createError({ statusCode: 409, statusMessage: 'resend_not_configured' })
  }

  const admin = useSupabaseAdmin(event)
  const campaign = await loadCampaign(event, id)
  if (campaign.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'campaign_not_draft' })
  }

  const content = campaignContent(campaign)
  if (!content.subject.fr.trim() && !content.subject.de.trim() && !content.subject.es.trim()) {
    throw createError({ statusCode: 422, statusMessage: 'campaign_empty' })
  }

  const { data: audience, error: audErr } = await admin.rpc('admin_campaign_audience', { p_segment: campaign.segment })
  if (audErr) throw createError({ statusCode: 500, statusMessage: 'audience_failed' })
  if (!audience?.length) throw createError({ statusCode: 422, statusMessage: 'audience_empty' })

  // Bloqueo optimista: solo una petición puede pasar de draft a sending.
  const { data: locked } = await admin
    .from('email_campaigns')
    .update({ status: 'sending', recipients_count: audience.length })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle()
  if (!locked) throw createError({ statusCode: 409, statusMessage: 'campaign_not_draft' })

  const ctx = await campaignContext(event)
  let sent = 0
  let failed = 0

  for (let i = 0; i < audience.length; i += CHUNK) {
    const chunk = audience.slice(i, i + CHUNK)
    const prepared = chunk.map(r => ({ r, msg: buildCampaignMessage(content, r, ctx, id) }))
    const sendable = prepared.filter(p => p.msg !== null)
    const results = await sendEmailBatch(event, sendable.map(p => p.msg!))

    const now = new Date().toISOString()
    const rows = prepared.map((p) => {
      const idx = sendable.indexOf(p)
      const res = idx >= 0 ? results[idx] : { id: null, error: 'no_content_for_locale' }
      if (res?.error) failed++
      else sent++
      return {
        campaign_id: id,
        subscriber_id: p.r.subscriber_id,
        email: p.r.email,
        locale: p.r.locale,
        status: res?.error ? 'failed' : 'sent',
        resend_message_id: res?.id ?? null,
        error: res?.error ?? null,
        sent_at: res?.error ? null : now,
      }
    })
    await admin.from('email_campaign_recipients').upsert(rows, { onConflict: 'campaign_id,email' })
  }

  const finalStatus = sent === 0 ? 'failed' : 'sent'
  await admin
    .from('email_campaigns')
    .update({ status: finalStatus, sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() })
    .eq('id', id)

  return { ok: sent > 0, status: finalStatus, recipients: audience.length, sent, failed }
})

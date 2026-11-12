import type { H3Event } from 'h3'
import { renderCampaignEmail, resolveCampaignLocale, type CampaignContent } from '../emails/campaign'

function loc(value: unknown) {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const s = (x: unknown) => (typeof x === 'string' ? x : '')
  return { fr: s(v.fr), de: s(v.de), es: s(v.es) }
}

export function campaignContent(row: { subject: unknown, preheader: unknown, body_html: unknown, body_text: unknown }): CampaignContent {
  return { subject: loc(row.subject), preheader: loc(row.preheader), body_html: loc(row.body_html), body_text: loc(row.body_text) }
}

export async function loadCampaign(event: H3Event, id: string) {
  const admin = useSupabaseAdmin(event)
  const { data, error } = await admin.from('email_campaigns').select('*').eq('id', id).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not load campaign' })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })
  return data
}

export async function campaignContext(event: H3Event) {
  const admin = useSupabaseAdmin(event)
  const { data: store } = await admin.from('store_settings').select('store_name').eq('id', 1).maybeSingle()
  const siteUrl = String(useRuntimeConfig(event).public.siteUrl).replace(/\/$/, '')
  return { storeName: store?.store_name ?? 'Shop', siteUrl }
}

export function unsubscribeUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildCampaignMessage(
  content: CampaignContent,
  recipient: { email: string, locale: string, unsubscribe_token: string },
  ctx: { storeName: string, siteUrl: string },
  campaignId: string,
) {
  const locale = resolveCampaignLocale(content, recipient.locale)
  if (!locale) return null
  const url = unsubscribeUrl(ctx.siteUrl, recipient.unsubscribe_token)
  const mail = renderCampaignEmail({ content, locale, storeName: ctx.storeName, siteUrl: ctx.siteUrl, unsubscribeUrl: url })
  return {
    to: recipient.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'campaign', value: campaignId.replace(/-/g, '') }],
  }
}

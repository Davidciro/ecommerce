/**
 * Render de campañas de newsletter: contenido HTML del admin + pie legal con baja.
 * El admin puede usar {{unsubscribe_url}} dentro del cuerpo; el pie siempre la incluye.
 */
import { escapeHtml, htmlToText } from '../utils/html'
import { renderEmailLayout } from './layout'

type Lang = 'fr' | 'de' | 'es'

const FOOTER: Record<Lang, { why: string, unsubscribe: string }> = {
  fr: { why: 'Vous recevez cet e-mail car vous êtes inscrit(e) à notre newsletter.', unsubscribe: 'Se désinscrire' },
  de: { why: 'Sie erhalten diese E-Mail, weil Sie unseren Newsletter abonniert haben.', unsubscribe: 'Abmelden' },
  es: { why: 'Recibes este correo porque estás suscrito/a a nuestra newsletter.', unsubscribe: 'Darse de baja' },
}

export interface LocalizedText { fr: string, de: string, es: string }

export interface CampaignContent {
  subject: LocalizedText
  preheader: LocalizedText
  body_html: LocalizedText
  body_text: LocalizedText
}

/** Idioma efectivo: el del destinatario si tiene asunto y cuerpo; si no, francés. */
export function resolveCampaignLocale(c: CampaignContent, locale: string): Lang | null {
  const has = (l: Lang) => Boolean(c.subject[l]?.trim() && c.body_html[l]?.trim())
  const wanted = (['fr', 'de', 'es'] as const).includes(locale as Lang) ? (locale as Lang) : 'fr'
  if (has(wanted)) return wanted
  if (has('fr')) return 'fr'
  return (['de', 'es'] as const).find(has) ?? null
}

export function renderCampaignEmail(input: {
  content: CampaignContent
  locale: Lang
  storeName: string
  siteUrl: string
  unsubscribeUrl: string
}) {
  const { content, locale } = input
  const body = content.body_html[locale].split('{{unsubscribe_url}}').join(escapeHtml(input.unsubscribeUrl))
  const footer = `${escapeHtml(FOOTER[locale].why)}<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#71717a">${escapeHtml(FOOTER[locale].unsubscribe)}</a>`

  const html = renderEmailLayout({
    lang: locale,
    storeName: input.storeName,
    siteUrl: `${input.siteUrl}/${locale}`,
    preheader: content.preheader[locale] || undefined,
    bodyHtml: body,
    footerHtml: footer,
  })
  const textBody = content.body_text[locale]?.trim() || htmlToText(body)
  const text = `${textBody}\n\n--\n${FOOTER[locale].why}\n${FOOTER[locale].unsubscribe}: ${input.unsubscribeUrl}`

  return { subject: content.subject[locale], html, text }
}

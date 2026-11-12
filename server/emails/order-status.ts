/**
 * Email al cliente cuando cambia el estado de su pedido (fr / de / es).
 */
import { escapeHtml, htmlToText } from '../utils/html'
import { renderEmailLayout } from './layout'

type Lang = 'fr' | 'de' | 'es'
type Status = 'pending' | 'in_progress' | 'shipped' | 'completed' | 'cancelled'

const T: Record<Lang, {
  subject: (n: number, s: string) => string
  greeting: (name: string) => string
  intro: (n: number) => string
  status: Record<Status, string>
  message: Record<Status, string>
  note: string
  tracking: string
  carrier: string
  trackLink: string
  account: string
  footer: string
}> = {
  fr: {
    subject: (n, s) => `Commande n° ${n} : ${s}`,
    greeting: name => (name ? `Bonjour ${name},` : 'Bonjour,'),
    intro: n => `Le statut de votre commande n° ${n} a été mis à jour.`,
    status: { pending: 'En attente', in_progress: 'En préparation', shipped: 'Expédiée', completed: 'Terminée', cancelled: 'Annulée' },
    message: {
      pending: 'Nous avons bien reçu votre commande.',
      in_progress: 'Nous préparons actuellement votre commande.',
      shipped: 'Votre commande est en route.',
      completed: 'Votre commande est terminée. Merci pour votre confiance !',
      cancelled: 'Votre commande a été annulée. Si un paiement a été effectué, il vous sera remboursé.',
    },
    note: 'Message de la boutique',
    tracking: 'Numéro de suivi',
    carrier: 'Transporteur',
    trackLink: 'Suivre mon colis',
    account: 'Voir mes commandes',
    footer: 'Vous recevez cet e-mail car vous avez passé une commande dans notre boutique.',
  },
  de: {
    subject: (n, s) => `Bestellung Nr. ${n}: ${s}`,
    greeting: name => (name ? `Guten Tag ${name}` : 'Guten Tag'),
    intro: n => `Der Status Ihrer Bestellung Nr. ${n} wurde aktualisiert.`,
    status: { pending: 'Ausstehend', in_progress: 'In Bearbeitung', shipped: 'Versandt', completed: 'Abgeschlossen', cancelled: 'Storniert' },
    message: {
      pending: 'Wir haben Ihre Bestellung erhalten.',
      in_progress: 'Wir bereiten Ihre Bestellung gerade vor.',
      shipped: 'Ihre Bestellung ist unterwegs.',
      completed: 'Ihre Bestellung ist abgeschlossen. Vielen Dank für Ihr Vertrauen!',
      cancelled: 'Ihre Bestellung wurde storniert. Eine bereits geleistete Zahlung wird Ihnen erstattet.',
    },
    note: 'Nachricht vom Shop',
    tracking: 'Sendungsnummer',
    carrier: 'Versanddienst',
    trackLink: 'Sendung verfolgen',
    account: 'Meine Bestellungen ansehen',
    footer: 'Sie erhalten diese E-Mail, weil Sie in unserem Shop bestellt haben.',
  },
  es: {
    subject: (n, s) => `Pedido n.º ${n}: ${s}`,
    greeting: name => (name ? `Hola ${name}:` : 'Hola:'),
    intro: n => `El estado de tu pedido n.º ${n} se ha actualizado.`,
    status: { pending: 'Pendiente', in_progress: 'En curso', shipped: 'Enviado', completed: 'Finalizado', cancelled: 'Cancelado' },
    message: {
      pending: 'Hemos recibido tu pedido.',
      in_progress: 'Estamos preparando tu pedido.',
      shipped: 'Tu pedido está en camino.',
      completed: 'Tu pedido ha finalizado. ¡Gracias por tu confianza!',
      cancelled: 'Tu pedido ha sido cancelado. Si realizaste un pago, se te reembolsará.',
    },
    note: 'Mensaje de la tienda',
    tracking: 'Número de seguimiento',
    carrier: 'Transportista',
    trackLink: 'Seguir mi envío',
    account: 'Ver mis pedidos',
    footer: 'Recibes este correo porque realizaste un pedido en nuestra tienda.',
  },
}

export interface OrderStatusEmailInput {
  locale: string
  storeName: string
  siteUrl: string
  orderNumber: number
  customerName: string | null
  status: Status
  note?: string | null
  carrier?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
}

export function buildOrderStatusEmail(i: OrderStatusEmailInput) {
  const lang: Lang = (['fr', 'de', 'es'] as const).includes(i.locale as Lang) ? (i.locale as Lang) : 'fr'
  const t = T[lang]
  const statusLabel = t.status[i.status]
  const btn = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${escapeHtml(label)}</a>`

  let body = `<p>${escapeHtml(t.greeting(i.customerName ?? ''))}</p>
<p>${escapeHtml(t.intro(i.orderNumber))}</p>
<p style="font-size:18px;font-weight:bold;margin:24px 0 8px">${escapeHtml(statusLabel)}</p>
<p>${escapeHtml(t.message[i.status])}</p>`

  if (i.status === 'shipped' && (i.trackingNumber || i.trackingUrl)) {
    body += `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px">`
    if (i.carrier) body += `<tr><td style="padding:2px 12px 2px 0;color:#71717a">${escapeHtml(t.carrier)}</td><td>${escapeHtml(i.carrier)}</td></tr>`
    if (i.trackingNumber) body += `<tr><td style="padding:2px 12px 2px 0;color:#71717a">${escapeHtml(t.tracking)}</td><td>${escapeHtml(i.trackingNumber)}</td></tr>`
    body += `</table>`
    if (i.trackingUrl) body += `<p>${btn(i.trackingUrl, t.trackLink)}</p>`
  }

  if (i.note?.trim()) {
    body += `<div style="margin:24px 0;padding:16px;background:#f4f4f5;border-radius:8px">
<p style="margin:0 0 4px;font-size:13px;color:#71717a">${escapeHtml(t.note)}</p>
<p style="margin:0;white-space:pre-line">${escapeHtml(i.note.trim())}</p></div>`
  }

  body += `<p style="margin-top:28px">${btn(`${i.siteUrl}/${lang}/account`, t.account)}</p>`

  const html = renderEmailLayout({
    lang,
    storeName: i.storeName,
    siteUrl: `${i.siteUrl}/${lang}`,
    preheader: `${statusLabel} — ${t.message[i.status]}`,
    bodyHtml: body,
    footerHtml: escapeHtml(t.footer),
  })
  return { subject: t.subject(i.orderNumber, statusLabel), html, text: htmlToText(body) }
}

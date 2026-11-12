/**
 * Envío de correos con Resend (API HTTP, sin SDK).
 * Requiere NUXT_RESEND_API_KEY y NUXT_RESEND_FROM_EMAIL (dominio verificado en Resend).
 */
import type { H3Event } from 'h3'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
  tags?: { name: string, value: string }[]
}

export interface SendResult {
  id: string | null
  error: string | null
}

const RESEND_API = 'https://api.resend.com'

function resendConfig(event: H3Event) {
  const config = useRuntimeConfig(event)
  return {
    apiKey: config.resendApiKey as string,
    from: config.resendFromEmail as string,
  }
}

export function isEmailConfigured(event: H3Event): boolean {
  const { apiKey, from } = resendConfig(event)
  return Boolean(apiKey && from)
}

function toPayload(from: string, m: EmailMessage) {
  return {
    from,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    reply_to: m.replyTo,
    headers: m.headers,
    tags: m.tags,
  }
}

export async function sendEmail(event: H3Event, message: EmailMessage): Promise<SendResult> {
  const { apiKey, from } = resendConfig(event)
  if (!apiKey || !from) return { id: null, error: 'resend_not_configured' }
  try {
    const res = await $fetch<{ id: string }>(`${RESEND_API}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: toPayload(from, message),
      timeout: 15_000,
    })
    return { id: res.id, error: null }
  }
  catch (err: unknown) {
    return { id: null, error: resendErrorMessage(err) }
  }
}

/** Envío por lotes (Resend admite hasta 100 mensajes por llamada). */
export async function sendEmailBatch(event: H3Event, messages: EmailMessage[]): Promise<SendResult[]> {
  const { apiKey, from } = resendConfig(event)
  if (!apiKey || !from) return messages.map(() => ({ id: null, error: 'resend_not_configured' }))
  if (messages.length === 0) return []
  if (messages.length > 100) throw new Error('batch too large')
  try {
    const res = await $fetch<{ data: { id: string }[] }>(`${RESEND_API}/emails/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: messages.map(m => toPayload(from, m)),
      timeout: 30_000,
    })
    return messages.map((_, i) => ({ id: res.data?.[i]?.id ?? null, error: res.data?.[i]?.id ? null : 'missing_id' }))
  }
  catch (err: unknown) {
    const msg = resendErrorMessage(err)
    return messages.map(() => ({ id: null, error: msg }))
  }
}

function resendErrorMessage(err: unknown): string {
  const e = err as { data?: { message?: string }, message?: string }
  return (e?.data?.message || e?.message || 'send_failed').slice(0, 500)
}

/** Registra el envío en email_logs (service role). Nunca lanza. */
export async function logEmail(
  event: H3Event,
  entry: { kind: 'order_confirmation' | 'order_status' | 'admin_new_order' | 'contact_form' | 'newsletter_confirm' | 'campaign', to: string, orderId?: string | null, result: SendResult },
): Promise<void> {
  try {
    await useSupabaseAdmin(event).from('email_logs').insert({
      kind: entry.kind,
      to_email: entry.to,
      order_id: entry.orderId ?? null,
      resend_message_id: entry.result.id,
      status: entry.result.error ? 'failed' : 'sent',
      error: entry.result.error,
    })
  }
  catch {
    // el log no debe romper el flujo principal
  }
}

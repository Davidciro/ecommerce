/**
 * Stripe con las llaves DEL DUEÑO, guardadas en public.store_secrets.
 * Solo se leen con el cliente service role (la tabla no tiene políticas RLS).
 */
import Stripe from 'stripe'
import type { H3Event } from 'h3'

export interface StripeSecrets {
  secretKey: string | null
  webhookSecret: string | null
}

export async function getStripeSecrets(event: H3Event): Promise<StripeSecrets> {
  const admin = useSupabaseAdmin(event)
  const { data, error } = await admin
    .from('store_secrets')
    .select('stripe_secret_key, stripe_webhook_secret')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Could not read payment configuration' })
  }
  return { secretKey: data?.stripe_secret_key ?? null, webhookSecret: data?.stripe_webhook_secret ?? null }
}

// Reutiliza el cliente mientras la llave no cambie (instancias por proceso serverless).
const clients = new Map<string, Stripe>()

export async function getStripe(event: H3Event): Promise<Stripe> {
  const { secretKey } = await getStripeSecrets(event)
  if (!secretKey) {
    throw createError({ statusCode: 409, statusMessage: 'stripe_not_configured' })
  }
  let client = clients.get(secretKey)
  if (!client) {
    clients.clear()
    client = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: 'nuxt-supabase-shop' },
    })
    clients.set(secretKey, client)
  }
  return client
}

export function stripeKeyMode(key: string | null | undefined): 'live' | 'test' | null {
  if (!key) return null
  if (key.includes('_live_')) return 'live'
  if (key.includes('_test_')) return 'test'
  return null
}

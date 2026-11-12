/**
 * POST /api/admin/settings/stripe-test — verifica las llaves de Stripe del dueño
 * consultando su cuenta. Devuelve datos no sensibles y advertencias de configuración.
 */
import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const { secretKey } = await getStripeSecrets(event)
  if (!secretKey) {
    return { ok: false, error: 'secret_key_missing' as const }
  }

  const admin = useSupabaseAdmin(event)
  const { data: settings } = await admin
    .from('store_settings')
    .select('currency, payment_methods, stripe_publishable_key')
    .eq('id', 1)
    .maybeSingle()

  const warnings: string[] = []
  const secretMode = stripeKeyMode(secretKey)
  const publishableMode = stripeKeyMode(settings?.stripe_publishable_key)
  if (!settings?.stripe_publishable_key) warnings.push('publishable_key_missing')
  else if (publishableMode !== secretMode) warnings.push('mode_mismatch')

  try {
    const stripe = await getStripe(event)
    const account = await stripe.accounts.retrieveCurrent()

    const caps = (account.capabilities ?? {}) as Record<string, string | undefined>
    const methods = settings?.payment_methods ?? []
    if (methods.includes('twint') && caps.twint_payments !== 'active') warnings.push('twint_not_active')
    if (!account.charges_enabled) warnings.push('charges_disabled')
    if (!account.payouts_enabled) warnings.push('payouts_disabled')
    if (account.default_currency && settings?.currency && account.default_currency.toUpperCase() !== settings.currency) {
      warnings.push('currency_differs')
    }

    return {
      ok: true,
      mode: secretMode,
      account: {
        id: account.id,
        name: account.business_profile?.name || account.settings?.dashboard?.display_name || null,
        country: account.country ?? null,
        defaultCurrency: account.default_currency?.toUpperCase() ?? null,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        twint: caps.twint_payments ?? null,
        cards: caps.card_payments ?? null,
      },
      warnings,
    }
  }
  catch (err) {
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return { ok: false, error: 'invalid_secret_key' as const }
    }
    if (err instanceof Stripe.errors.StripeConnectionError) {
      return { ok: false, error: 'stripe_unreachable' as const }
    }
    return { ok: false, error: 'stripe_error' as const }
  }
})

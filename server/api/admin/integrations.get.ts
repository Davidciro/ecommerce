/**
 * GET /api/admin/integrations — estado de integraciones para el panel
 * (sin exponer secretos): email configurado, URL del webhook de Stripe.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')
  const { secretKey, webhookSecret } = await getStripeSecrets(event)

  return {
    siteUrl,
    webhookUrl: `${siteUrl}/api/webhooks/stripe`,
    webhookEvents: [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ],
    stripe: {
      secretKeyConfigured: Boolean(secretKey),
      webhookSecretConfigured: Boolean(webhookSecret),
      mode: stripeKeyMode(secretKey),
    },
    email: {
      configured: isEmailConfigured(event),
      from: config.resendFromEmail || null,
    },
  }
})

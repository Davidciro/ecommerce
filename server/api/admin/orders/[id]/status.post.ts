/**
 * POST /api/admin/orders/:id/status
 * Cambia el estado (RPC admin_set_order_status: historial + reposición de stock al cancelar)
 * y, opcionalmente, notifica al cliente por email en su idioma.
 */
import { z } from 'zod'
import { buildOrderStatusEmail } from '../../../../emails/order-status'

const Body = z.object({
  status: z.enum(['pending', 'in_progress', 'shipped', 'completed', 'cancelled']),
  note: z.string().trim().max(2000).optional().nullable(),
  notify: z.boolean().default(false),
  restock: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !z.uuid().safeParse(id).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid order id' })
  }
  const body = await readValidatedBody(event, Body.parse)

  // Con el cliente del usuario: la RPC registra auth.uid() como autor del cambio.
  const client = await useServerSupabase(event)
  const { data: order, error } = await client.rpc('admin_set_order_status', {
    p_order_id: id,
    p_status: body.status,
    p_note: body.note ?? undefined,
    p_restock: body.restock,
  })
  if (error || !order) {
    const cancelled = error?.message?.includes('cancelled')
    throw createError({
      statusCode: cancelled ? 409 : 400,
      statusMessage: cancelled ? 'order_cancelled' : 'status_update_failed',
    })
  }

  let notification: { sent: boolean, error: string | null } | null = null

  if (body.notify) {
    const admin = useSupabaseAdmin(event)
    const config = useRuntimeConfig(event)
    const { data: store } = await admin.from('store_settings').select('store_name').eq('id', 1).maybeSingle()

    const mail = buildOrderStatusEmail({
      locale: order.locale,
      storeName: store?.store_name ?? 'Shop',
      siteUrl: String(config.public.siteUrl).replace(/\/$/, ''),
      orderNumber: order.order_number,
      customerName: order.customer_name,
      status: order.status,
      note: body.note,
      carrier: order.carrier,
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url,
    })
    const result = await sendEmail(event, {
      to: order.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      tags: [{ name: 'type', value: 'order_status' }],
    })
    await logEmail(event, { kind: 'order_status', to: order.email, orderId: order.id, result })

    if (!result.error) {
      const { data: last } = await admin
        .from('order_status_history')
        .select('id')
        .eq('order_id', order.id)
        .eq('to_status', order.status)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (last) {
        await admin.from('order_status_history').update({ customer_notified_at: new Date().toISOString() }).eq('id', last.id)
      }
    }
    notification = { sent: !result.error, error: result.error }
  }

  return { ok: true, order: { id: order.id, status: order.status, stock_committed: order.stock_committed }, notification }
})

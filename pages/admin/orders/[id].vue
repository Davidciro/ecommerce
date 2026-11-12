<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  validate: route => /^[0-9a-f-]{36}$/i.test(String(route.params.id)),
})

type OrderStatus = Database['public']['Enums']['order_status']
const STATUSES: OrderStatus[] = ['pending', 'in_progress', 'shipped', 'completed', 'cancelled']

const { t, locale } = useI18n()
const route = useRoute()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const publicUrl = useStorageUrl()
const toast = useToast()
const { userId } = useAuth()

const id = String(route.params.id)

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------
const { data: order, refresh } = await useAsyncData(`adm:order:${id}`, async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_status_history(*), order_notes(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const itemIds = data.order_items.map(i => i.id)
  const { data: costs } = itemIds.length
    ? await supabase.from('order_item_costs').select('*').in('order_item_id', itemIds)
    : { data: [] }
  return {
    ...data,
    order_items: [...data.order_items].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    order_status_history: [...data.order_status_history].sort((a, b) => a.id - b.id),
    order_notes: [...data.order_notes].sort((a, b) => a.id - b.id),
    costs: Object.fromEntries((costs ?? []).map(c => [c.order_item_id, c])),
  }
})
if (!order.value) throw createError({ statusCode: 404, statusMessage: 'Order not found' })

useSeoMeta({ title: () => t('adm.orders.detail_title', { number: order.value?.order_number ?? '' }) })

const o = computed(() => order.value!)
const money = (v: number | string | null | undefined) => formatMoney(v, o.value.currency, locale.value)

const totals = computed(() => {
  const cost = o.value.order_items.reduce((s, i) => s + Number(o.value.costs[i.id]?.line_production_cost ?? 0), 0)
  const net = o.value.order_items.reduce((s, i) => s + Number(i.line_net), 0)
  return { cost, net, profit: net - cost }
})

interface Address { name?: string, line1?: string, line2?: string, postal_code?: string, city?: string, state?: string, country?: string }
function addressLines(a: unknown): string[] {
  if (!a || typeof a !== 'object') return []
  const x = a as Address
  return [x.name, x.line1, x.line2, [x.postal_code, x.city].filter(Boolean).join(' '), x.state, x.country].filter((l): l is string => Boolean(l && l.trim()))
}

// ---------------------------------------------------------------------------
// Cambio de estado
// ---------------------------------------------------------------------------
const statusForm = reactive({
  status: o.value.status as OrderStatus,
  note: '',
  notify: true,
  restock: true,
})
const changing = ref(false)
const isCancelled = computed(() => o.value.status === 'cancelled')

async function applyStatus() {
  if (statusForm.status === o.value.status) return
  changing.value = true
  try {
    const res = await $fetch(`/api/admin/orders/${id}/status`, {
      method: 'POST',
      body: {
        status: statusForm.status,
        note: statusForm.note.trim() || null,
        notify: statusForm.notify,
        restock: statusForm.restock,
      },
    })
    if (res.notification && !res.notification.sent) {
      toast.error(t('adm.orders.notify_failed', { error: res.notification.error ?? '' }))
    }
    else {
      toast.success(res.notification?.sent ? t('adm.orders.notified') : t('adm.orders.status_updated'))
    }
    statusForm.note = ''
    await refresh()
    statusForm.status = o.value.status
  }
  catch (err) {
    const msg = (err as { statusMessage?: string }).statusMessage
    toast.error(msg === 'order_cancelled' ? t('adm.orders.cancelled_final') : t('adm.common.error'))
  }
  finally {
    changing.value = false
  }
}

// ---------------------------------------------------------------------------
// Envío (columnas permitidas por GRANT: carrier, tracking_number, tracking_url)
// ---------------------------------------------------------------------------
const logistics = reactive({
  carrier: o.value.carrier ?? '',
  tracking_number: o.value.tracking_number ?? '',
  tracking_url: o.value.tracking_url ?? '',
})
const savingLogistics = ref(false)
const logisticsError = ref<string | null>(null)

async function saveLogistics() {
  logisticsError.value = null
  const url = logistics.tracking_url.trim()
  if (url && !/^https:\/\/\S+$/.test(url)) {
    logisticsError.value = t('adm.orders.tracking_url_hint')
    return
  }
  savingLogistics.value = true
  const { error } = await supabase.from('orders').update({
    carrier: logistics.carrier.trim() || null,
    tracking_number: logistics.tracking_number.trim() || null,
    tracking_url: url || null,
  }).eq('id', id)
  savingLogistics.value = false
  if (error) toast.error(t('adm.common.error'))
  else {
    toast.success(t('adm.common.saved'))
    await refresh()
  }
}

// ---------------------------------------------------------------------------
// Notas internas
// ---------------------------------------------------------------------------
const newNote = ref('')
const addingNote = ref(false)
async function addNote() {
  const body = newNote.value.trim()
  if (!body) return
  addingNote.value = true
  const { error } = await supabase.from('order_notes').insert({ order_id: id, author_id: userId.value, body })
  addingNote.value = false
  if (error) toast.error(t('adm.common.error'))
  else {
    newNote.value = ''
    await refresh()
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <AdminPageHeader
      :title="t('adm.orders.detail_title', { number: o.order_number })"
      :description="t('adm.orders.placed_on', { date: formatDate(o.created_at, locale, true) })"
      :back-to="localePath('/admin/orders')"
    >
      <template #actions>
        <AdminStatusBadge kind="order" :value="o.status" />
        <AdminStatusBadge kind="payment" :value="o.payment_status" />
      </template>
    </AdminPageHeader>

    <div v-if="o.needs_review" role="alert" class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p class="font-semibold">{{ t('adm.orders.review_title') }}</p>
      <p class="mt-1 break-words">{{ o.review_reason }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Columna principal -->
      <div class="space-y-6 lg:col-span-2">
        <!-- Artículos -->
        <section class="card p-0 sm:p-0">
          <h2 class="px-6 pt-6 text-lg font-semibold text-gray-900">{{ t('adm.orders.items') }}</h2>
          <div class="overflow-x-auto">
            <table class="mt-4 min-w-full text-sm">
              <thead class="border-y border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th scope="col" class="px-6 py-2">{{ t('adm.reports.col_product') }}</th>
                  <th scope="col" class="px-3 py-2 text-right">{{ t('adm.orders.qty') }}</th>
                  <th scope="col" class="px-3 py-2 text-right">{{ t('adm.orders.unit_price') }}</th>
                  <th scope="col" class="px-3 py-2 text-right">{{ t('adm.orders.line_total') }}</th>
                  <th scope="col" class="px-6 py-2 text-right">{{ t('adm.reports.col_profit') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="item in o.order_items" :key="item.id">
                  <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                      <span class="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <img v-if="item.image_path" :src="publicUrl('product-images', item.image_path) ?? ''" alt="" class="h-full w-full object-cover">
                      </span>
                      <span>
                        <NuxtLink v-if="item.product_id" :to="localePath(`/admin/products/${item.product_id}`)" class="font-medium text-gray-900 hover:text-brand-700">
                          {{ pickLocalized(item.product_name, locale) }}
                        </NuxtLink>
                        <span v-else class="font-medium text-gray-900">{{ pickLocalized(item.product_name, locale) }}</span>
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-right tabular-nums">{{ item.quantity }}</td>
                  <td class="whitespace-nowrap px-3 py-3 text-right tabular-nums">{{ money(item.unit_price) }}</td>
                  <td class="whitespace-nowrap px-3 py-3 text-right tabular-nums">{{ money(item.line_total) }}</td>
                  <td class="whitespace-nowrap px-6 py-3 text-right tabular-nums" :class="o.costs[item.id]?.cost_missing ? 'text-amber-700' : 'text-gray-600'">
                    {{ money(Number(item.line_net) - Number(o.costs[item.id]?.line_production_cost ?? 0)) }}
                    <span v-if="o.costs[item.id]?.cost_missing" title="cost missing">*</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl class="space-y-1 border-t border-gray-200 px-6 py-4 text-sm">
            <div class="flex justify-between"><dt class="text-gray-600">{{ t('adm.orders.subtotal') }}</dt><dd class="tabular-nums">{{ money(o.subtotal) }}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-600">{{ t('adm.orders.shipping') }}</dt><dd class="tabular-nums">{{ money(o.shipping_amount) }}</dd></div>
            <div class="flex justify-between text-gray-500">
              <dt>{{ o.prices_include_vat ? t('adm.orders.vat_included', { rate: o.vat_rate }) : t('adm.orders.vat_added', { rate: o.vat_rate }) }}</dt>
              <dd class="tabular-nums">{{ money(o.tax_amount) }}</dd>
            </div>
            <div class="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold"><dt>{{ t('adm.orders.total') }}</dt><dd class="tabular-nums">{{ money(o.total) }}</dd></div>
            <div class="flex justify-between pt-2 text-gray-500"><dt>{{ t('adm.reports.kpi_costs') }}</dt><dd class="tabular-nums">{{ money(totals.cost) }}</dd></div>
            <div class="flex justify-between font-medium" :class="totals.profit >= 0 ? 'text-green-700' : 'text-red-700'">
              <dt>{{ t('adm.reports.kpi_profit') }}</dt><dd class="tabular-nums">{{ money(totals.profit) }}</dd>
            </div>
          </dl>
        </section>

        <!-- Cambio de estado -->
        <section class="card">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.orders.change_status') }}</h2>
          <p v-if="isCancelled" class="mt-3 text-sm text-gray-600">{{ t('adm.orders.cancelled_final') }}</p>
          <form v-else class="mt-4 space-y-4" @submit.prevent="applyStatus">
            <div class="max-w-xs">
              <label for="o-status" class="form-label">{{ t('adm.orders.new_status') }}</label>
              <select id="o-status" v-model="statusForm.status" class="form-input">
                <option v-for="s in STATUSES" :key="s" :value="s">{{ t(`adm.orders.status.${s}`) }}</option>
              </select>
            </div>
            <div>
              <label for="o-note" class="form-label">{{ t('adm.orders.note') }} <span class="font-normal text-gray-400">({{ t('adm.common.optional') }})</span></label>
              <textarea id="o-note" v-model="statusForm.note" rows="3" maxlength="2000" class="form-input" />
              <p class="mt-1 text-xs text-gray-500">{{ t('adm.orders.note_hint') }}</p>
            </div>
            <label class="flex items-center gap-3">
              <input v-model="statusForm.notify" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
              <span class="text-sm text-gray-800">{{ t('adm.orders.notify_customer') }} ({{ o.email }})</span>
            </label>
            <label v-if="statusForm.status === 'cancelled' && o.stock_committed" class="flex items-center gap-3">
              <input v-model="statusForm.restock" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
              <span class="text-sm text-gray-800">{{ t('adm.orders.restock') }}</span>
            </label>
            <button type="submit" class="btn-primary" :disabled="changing || statusForm.status === o.status">
              {{ changing ? t('adm.common.saving') : t('adm.orders.apply_status') }}
            </button>
          </form>
        </section>

        <!-- Historial -->
        <section class="card">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.orders.history') }}</h2>
          <ol class="mt-4 space-y-4 border-l border-gray-200 pl-5">
            <li v-for="h in o.order_status_history" :key="h.id" class="relative">
              <span class="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-gray-400" aria-hidden="true" />
              <p class="text-sm">
                <AdminStatusBadge kind="order" :value="h.to_status" />
                <span class="ml-2 text-gray-500">{{ formatDate(h.created_at, locale, true) }} · {{ h.changed_by ? t('adm.orders.by_admin') : t('adm.orders.by_system') }}</span>
                <span v-if="h.customer_notified_at" class="ml-2 text-xs text-green-700">✉ {{ t('adm.orders.notified_at') }}</span>
              </p>
              <p v-if="h.note" class="mt-1 whitespace-pre-line text-sm text-gray-700">{{ h.note }}</p>
            </li>
          </ol>
        </section>
      </div>

      <!-- Columna lateral -->
      <aside class="space-y-6">
        <section class="card space-y-2 text-sm">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.orders.customer') }}</h2>
          <p class="font-medium text-gray-900">{{ o.customer_name || '—' }}</p>
          <p><a :href="`mailto:${o.email}`" class="text-brand-700 hover:underline">{{ o.email }}</a></p>
          <p v-if="o.phone"><a :href="`tel:${o.phone}`" class="text-gray-700">{{ o.phone }}</a></p>
          <p class="text-xs text-gray-500">{{ o.user_id ? t('adm.orders.registered') : t('adm.orders.guest') }} · {{ o.locale.toUpperCase() }}</p>
        </section>

        <section class="card space-y-4 text-sm">
          <div>
            <h2 class="font-semibold text-gray-900">{{ t('adm.orders.shipping_address') }}</h2>
            <address class="mt-1 not-italic text-gray-700">
              <template v-if="addressLines(o.shipping_address).length">
                <span v-for="(l, i) in addressLines(o.shipping_address)" :key="i" class="block">{{ l }}</span>
              </template>
              <span v-else class="text-gray-400">{{ t('adm.orders.no_address') }}</span>
            </address>
          </div>
          <div>
            <h2 class="font-semibold text-gray-900">{{ t('adm.orders.billing_address') }}</h2>
            <address class="mt-1 not-italic text-gray-700">
              <template v-if="addressLines(o.billing_address).length">
                <span v-for="(l, i) in addressLines(o.billing_address)" :key="i" class="block">{{ l }}</span>
              </template>
              <span v-else class="text-gray-400">{{ t('adm.orders.no_address') }}</span>
            </address>
          </div>
        </section>

        <section class="card space-y-2 text-sm">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.orders.payment_info') }}</h2>
          <p><span class="text-gray-500">{{ t('adm.orders.payment_method') }}:</span> {{ o.payment_method_type || '—' }}</p>
          <p class="break-all"><span class="text-gray-500">{{ t('adm.orders.stripe_pi') }}:</span> <code class="text-xs">{{ o.stripe_payment_intent_id || '—' }}</code></p>
          <p class="break-all"><span class="text-gray-500">{{ t('adm.orders.stripe_session') }}:</span> <code class="text-xs">{{ o.stripe_checkout_session_id }}</code></p>
        </section>

        <section class="card">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.orders.logistics') }}</h2>
          <form class="mt-4 space-y-3" @submit.prevent="saveLogistics">
            <div>
              <label for="o-carrier" class="form-label">{{ t('adm.orders.carrier') }}</label>
              <input id="o-carrier" v-model="logistics.carrier" type="text" maxlength="80" class="form-input" placeholder="La Poste / DHL…">
            </div>
            <div>
              <label for="o-track" class="form-label">{{ t('adm.orders.tracking_number') }}</label>
              <input id="o-track" v-model="logistics.tracking_number" type="text" maxlength="100" class="form-input">
            </div>
            <div>
              <label for="o-track-url" class="form-label">{{ t('adm.orders.tracking_url') }}</label>
              <input id="o-track-url" v-model="logistics.tracking_url" type="url" class="form-input" placeholder="https://">
              <p class="mt-1 text-xs" :class="logisticsError ? 'text-red-600' : 'text-gray-500'">{{ logisticsError || t('adm.orders.tracking_url_hint') }}</p>
            </div>
            <button type="submit" class="btn-secondary w-full" :disabled="savingLogistics">{{ t('adm.orders.save_logistics') }}</button>
          </form>
        </section>

        <section class="card">
          <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.orders.internal_notes') }}</h2>
          <p class="text-xs text-gray-500">{{ t('adm.orders.internal_notes_hint') }}</p>
          <ul class="mt-4 space-y-3">
            <li v-for="n in o.order_notes" :key="n.id" class="rounded-lg bg-gray-50 p-3 text-sm">
              <p class="whitespace-pre-line text-gray-800">{{ n.body }}</p>
              <p class="mt-1 text-xs text-gray-500">{{ formatDate(n.created_at, locale, true) }}</p>
            </li>
            <li v-if="!o.order_notes.length" class="text-sm text-gray-500">{{ t('adm.orders.no_notes') }}</li>
          </ul>
          <form class="mt-4 space-y-2" @submit.prevent="addNote">
            <label for="o-new-note" class="sr-only">{{ t('adm.orders.note_placeholder') }}</label>
            <textarea id="o-new-note" v-model="newNote" rows="3" maxlength="5000" class="form-input" :placeholder="t('adm.orders.note_placeholder')" />
            <button type="submit" class="btn-secondary w-full" :disabled="addingNote || !newNote.trim()">{{ t('adm.orders.add_note') }}</button>
          </form>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()

useSeoMeta({ title: () => t('adm.reports.title') })

// ---------------------------------------------------------------------------
// Filtros (fechas en formato YYYY-MM-DD; rango inclusivo en la UI)
// ---------------------------------------------------------------------------
function iso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today = new Date()
const filters = reactive({
  from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
  to: iso(today),
  productId: '' as string,
})
const applied = ref({ ...filters })

function preset(kind: 'this_month' | 'last_month' | 'last_30' | 'this_year') {
  const n = new Date()
  if (kind === 'this_month') { filters.from = iso(new Date(n.getFullYear(), n.getMonth(), 1)); filters.to = iso(n) }
  if (kind === 'last_month') { filters.from = iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)); filters.to = iso(new Date(n.getFullYear(), n.getMonth(), 0)) }
  if (kind === 'last_30') { filters.from = iso(new Date(n.getTime() - 29 * 86400000)); filters.to = iso(n) }
  if (kind === 'this_year') { filters.from = iso(new Date(n.getFullYear(), 0, 1)); filters.to = iso(n) }
  apply()
}
function apply() {
  if (filters.from > filters.to) [filters.from, filters.to] = [filters.to, filters.from]
  applied.value = { ...filters }
}

/** Rango semiabierto [from 00:00, to+1 00:00) en la zona horaria del navegador. */
const range = computed(() => {
  const from = new Date(`${applied.value.from}T00:00:00`)
  const to = new Date(`${applied.value.to}T00:00:00`)
  to.setDate(to.getDate() + 1)
  return { p_from: from.toISOString(), p_to: to.toISOString(), p_product_id: applied.value.productId || undefined }
})

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------
const { data: products } = await useAsyncData('adm:report-products', async () => {
  const { data } = await supabase.from('products').select('id, name').order('created_at', { ascending: false })
  return data ?? []
})
const { data: store } = await useAsyncData('adm:report-store', async () => {
  const { data } = await supabase.from('store_settings').select('currency').eq('id', 1).single()
  return data
})
const currency = computed(() => store.value?.currency ?? 'CHF')

const { data: report, pending, error } = await useAsyncData(
  'adm:report',
  async () => {
    const [summary, rows] = await Promise.all([
      supabase.rpc('admin_sales_summary', range.value),
      supabase.rpc('admin_sales_report', range.value),
    ])
    if (summary.error) throw summary.error
    if (rows.error) throw rows.error
    return { summary: summary.data?.[0] ?? null, rows: rows.data ?? [] }
  },
  { watch: [range] },
)

const s = computed(() => report.value?.summary)
const money = (v: number | string | null | undefined) => formatMoney(v, currency.value, locale.value)

// ---------------------------------------------------------------------------
// Exportación CSV
// ---------------------------------------------------------------------------
function exportCsv() {
  const rows = report.value?.rows ?? []
  const csv = toCsv(rows, [
    { header: t('adm.reports.col_date'), value: r => r.order_date.slice(0, 19).replace('T', ' ') },
    { header: t('adm.reports.col_order'), value: r => r.order_number },
    { header: t('adm.reports.col_customer'), value: r => r.customer_email },
    { header: t('adm.reports.col_product'), value: r => pickLocalized(r.product_name, locale.value) },
    { header: t('adm.reports.col_qty'), value: r => r.quantity },
    { header: t('adm.reports.col_unit'), value: r => Number(r.unit_price).toFixed(2) },
    { header: t('adm.reports.col_total'), value: r => Number(r.line_total).toFixed(2) },
    { header: t('adm.reports.col_net'), value: r => Number(r.line_net).toFixed(2) },
    { header: t('adm.reports.col_cost'), value: r => Number(r.line_production_cost).toFixed(2) },
    { header: t('adm.reports.col_profit'), value: r => Number(r.line_profit).toFixed(2) },
    { header: 'Currency', value: r => r.currency },
  ])
  downloadCsv(`ventas_${applied.value.from}_${applied.value.to}.csv`, csv)
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <AdminPageHeader :title="t('adm.reports.title')" :description="t('adm.reports.intro')">
      <template #actions>
        <button type="button" class="btn-secondary" :disabled="!report?.rows.length" @click="exportCsv">{{ t('adm.common.export_csv') }}</button>
      </template>
    </AdminPageHeader>

    <!-- Filtros -->
    <form class="card mb-6 flex flex-wrap items-end gap-4" @submit.prevent="apply">
      <div>
        <label for="r-from" class="form-label">{{ t('adm.common.from') }}</label>
        <input id="r-from" v-model="filters.from" type="date" class="form-input">
      </div>
      <div>
        <label for="r-to" class="form-label">{{ t('adm.common.to') }}</label>
        <input id="r-to" v-model="filters.to" type="date" class="form-input">
      </div>
      <div class="min-w-56">
        <label for="r-product" class="form-label">{{ t('adm.reports.product') }}</label>
        <select id="r-product" v-model="filters.productId" class="form-input">
          <option value="">{{ t('adm.reports.all_products') }}</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ pickLocalized(p.name, locale) || p.id }}</option>
        </select>
      </div>
      <button type="submit" class="btn-primary">{{ t('adm.common.apply') }}</button>
      <div class="flex flex-wrap gap-2">
        <button v-for="k in (['this_month', 'last_month', 'last_30', 'this_year'] as const)" :key="k" type="button" class="btn-ghost px-3 py-1.5 text-xs" @click="preset(k)">
          {{ t(`adm.reports.presets.${k}`) }}
        </button>
      </div>
    </form>

    <p v-if="error" role="alert" class="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ t('adm.common.error') }}</p>

    <!-- KPIs -->
    <div v-if="s" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" :class="{ 'opacity-60': pending }">
      <AdminKpiCard :label="t('adm.reports.kpi_gross')" :value="money(s.gross_revenue)" :hint="t('adm.reports.kpi_gross_hint')" />
      <AdminKpiCard :label="t('adm.reports.kpi_costs')" :value="money(s.production_costs)" />
      <AdminKpiCard :label="t('adm.reports.kpi_profit')" :value="money(s.net_profit)" :hint="t('adm.reports.kpi_profit_hint')" :tone="Number(s.net_profit) >= 0 ? 'positive' : 'negative'" />
      <AdminKpiCard :label="t('adm.reports.kpi_units')" :value="formatNumber(s.units_sold, locale)" />
      <AdminKpiCard :label="t('adm.reports.kpi_net_revenue')" :value="money(s.net_revenue)" :hint="t('adm.reports.kpi_net_hint')" />
      <AdminKpiCard :label="t('adm.reports.kpi_vat')" :value="money(s.vat_collected)" />
      <AdminKpiCard :label="t('adm.reports.kpi_orders')" :value="formatNumber(s.orders_count, locale)" />
      <AdminKpiCard :label="t('adm.reports.kpi_shipping')" :value="money(s.shipping_revenue)" />
    </div>

    <p v-if="s && Number(s.lines_cost_missing) > 0" role="status" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {{ t('adm.reports.cost_missing', { count: s.lines_cost_missing }) }}
    </p>

    <!-- Detalle -->
    <section class="mt-8" aria-labelledby="report-table">
      <h2 id="report-table" class="mb-3 text-lg font-semibold text-gray-900">{{ t('adm.reports.table_title') }}</h2>
      <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" class="px-4 py-3">{{ t('adm.reports.col_date') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('adm.reports.col_order') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('adm.reports.col_product') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('adm.reports.col_qty') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('adm.reports.col_total') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('adm.reports.col_net') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('adm.reports.col_cost') }}</th>
              <th scope="col" class="px-4 py-3 text-right">{{ t('adm.reports.col_profit') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(r, i) in report?.rows" :key="`${r.order_id}-${i}`" class="hover:bg-gray-50">
              <td class="whitespace-nowrap px-4 py-2 text-gray-600">{{ formatDate(r.order_date, locale) }}</td>
              <td class="px-4 py-2">
                <NuxtLink :to="localePath(`/admin/orders/${r.order_id}`)" class="font-medium text-gray-900 hover:text-brand-700">#{{ r.order_number }}</NuxtLink>
              </td>
              <td class="px-4 py-2">{{ pickLocalized(r.product_name, locale) }}</td>
              <td class="px-4 py-2 text-right tabular-nums">{{ r.quantity }}</td>
              <td class="whitespace-nowrap px-4 py-2 text-right tabular-nums">{{ money(r.line_total) }}</td>
              <td class="whitespace-nowrap px-4 py-2 text-right tabular-nums">{{ money(r.line_net) }}</td>
              <td class="whitespace-nowrap px-4 py-2 text-right tabular-nums" :class="r.cost_missing ? 'text-amber-700' : ''">{{ money(r.line_production_cost) }}{{ r.cost_missing ? ' *' : '' }}</td>
              <td class="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums" :class="Number(r.line_profit) >= 0 ? 'text-green-700' : 'text-red-700'">{{ money(r.line_profit) }}</td>
            </tr>
            <tr v-if="!pending && !report?.rows.length">
              <td colspan="8" class="px-4 py-12 text-center text-gray-500">{{ t('adm.reports.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

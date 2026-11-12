<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const { displayName } = useAuth()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()

useSeoMeta({ title: () => `${t('admin.dashboard')} · ${t('admin.title')}` })

const { data } = await useAsyncData('adm:dashboard', async () => {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 86400000)
  const [summary, stats, lowStock, store] = await Promise.all([
    supabase.rpc('admin_sales_summary', { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.rpc('admin_dashboard_stats'),
    supabase.rpc('admin_low_stock_products'),
    supabase.from('store_settings').select('currency').eq('id', 1).single(),
  ])
  return {
    summary: summary.data?.[0] ?? null,
    stats: stats.data?.[0] ?? null,
    lowStock: (lowStock.data ?? []).filter(p => p.is_active).slice(0, 8),
    currency: store.data?.currency ?? 'CHF',
  }
})
const { data: integrations } = await useFetch('/api/admin/integrations', { key: 'adm:integrations' })

const money = (v: number | string | null | undefined) => formatMoney(v, data.value?.currency ?? 'CHF', locale.value)
const stats = computed(() => data.value?.stats)
const setupOk = computed(() => integrations.value?.stripe.secretKeyConfigured && integrations.value?.email.configured)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('admin.welcome', { name: displayName }) }}</h1>
      <p class="mt-1 text-gray-600">{{ t('admin.intro') }}</p>
    </div>

    <!-- Configuración pendiente -->
    <section v-if="integrations && !setupOk" class="rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="setup-title">
      <h2 id="setup-title" class="font-semibold text-amber-900">{{ t('adm.dashboard.setup_title') }}</h2>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
        <li v-if="!integrations.stripe.secretKeyConfigured">
          <NuxtLink :to="localePath('/admin/settings')" class="underline">{{ t('adm.dashboard.setup_stripe') }}</NuxtLink>
        </li>
        <li v-if="!integrations.email.configured">{{ t('adm.dashboard.setup_email') }}</li>
      </ul>
    </section>

    <!-- Ventas últimos 30 días -->
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title" class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{{ t('adm.dashboard.last_30_days') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminKpiCard :label="t('adm.dashboard.kpi_revenue')" :value="money(data?.summary?.gross_revenue)" :to="localePath('/admin/reports')" />
        <AdminKpiCard
          :label="t('adm.dashboard.kpi_profit')"
          :value="money(data?.summary?.net_profit)"
          :tone="Number(data?.summary?.net_profit ?? 0) >= 0 ? 'positive' : 'negative'"
          :to="localePath('/admin/reports')"
        />
        <AdminKpiCard :label="t('adm.dashboard.kpi_orders')" :value="formatNumber(data?.summary?.orders_count, locale)" />
        <AdminKpiCard :label="t('adm.dashboard.kpi_units')" :value="formatNumber(data?.summary?.units_sold, locale)" />
      </div>
    </section>

    <!-- Contadores -->
    <section v-if="stats" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AdminKpiCard :label="t('adm.dashboard.pending_orders')" :value="stats.pending_orders" :tone="stats.pending_orders ? 'warning' : 'default'" :to="localePath('/admin/orders?status=pending')" />
      <AdminKpiCard :label="t('adm.dashboard.in_progress_orders')" :value="stats.in_progress_orders" :to="localePath('/admin/orders?status=in_progress')" />
      <AdminKpiCard :label="t('adm.dashboard.needs_review')" :value="stats.needs_review_orders" :tone="stats.needs_review_orders ? 'negative' : 'default'" :to="localePath('/admin/orders?review=1')" />
      <AdminKpiCard :label="t('adm.dashboard.unhandled_messages')" :value="stats.unhandled_messages" :tone="stats.unhandled_messages ? 'warning' : 'default'" :to="localePath('/admin/messages')" />
      <AdminKpiCard :label="t('adm.dashboard.active_products')" :value="stats.active_products" :to="localePath('/admin/products')" />
      <AdminKpiCard :label="t('adm.dashboard.low_stock')" :value="stats.low_stock_products" :tone="stats.low_stock_products ? 'warning' : 'default'" />
      <AdminKpiCard :label="t('adm.dashboard.customers')" :value="stats.customers" :to="localePath('/admin/customers')" />
      <AdminKpiCard :label="t('adm.dashboard.subscribers')" :value="stats.subscribers" :to="localePath('/admin/campaigns')" />
    </section>

    <!-- Stock bajo -->
    <section class="card" aria-labelledby="low-stock-title">
      <h2 id="low-stock-title" class="text-lg font-semibold text-gray-900">{{ t('adm.dashboard.low_stock_title') }}</h2>
      <ul v-if="data?.lowStock.length" class="mt-4 divide-y divide-gray-100">
        <li v-for="p in data.lowStock" :key="p.product_id" class="flex items-center justify-between py-2 text-sm">
          <NuxtLink :to="localePath(`/admin/products/${p.product_id}`)" class="text-gray-900 hover:text-brand-700">{{ pickLocalized(p.name, locale) }}</NuxtLink>
          <span class="font-semibold tabular-nums" :class="p.stock === 0 ? 'text-red-700' : 'text-amber-700'">{{ p.stock }}</span>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-gray-500">{{ t('adm.dashboard.none_low_stock') }}</p>
    </section>
  </div>
</template>

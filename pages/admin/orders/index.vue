<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type OrderStatus = Database['public']['Enums']['order_status']
const STATUSES: OrderStatus[] = ['pending', 'in_progress', 'shipped', 'completed', 'cancelled']

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const route = useRoute()

useSeoMeta({ title: () => t('adm.orders.title') })

const PAGE_SIZE = 25
const page = ref(1)
const search = ref(typeof route.query.q === 'string' ? route.query.q.slice(0, 100) : '')
const status = ref<OrderStatus | ''>(STATUSES.includes(route.query.status as OrderStatus) ? (route.query.status as OrderStatus) : '')
const reviewOnly = ref(route.query.review === '1')
const debounced = refDebounced(search, 300)
watch([debounced, status, reviewOnly], () => { page.value = 1 })

const { data, pending } = await useAsyncData(
  'adm:orders',
  async () => {
    let q = supabase
      .from('orders')
      .select('id, order_number, created_at, email, customer_name, total, currency, status, payment_status, needs_review, user_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE - 1)

    const term = debounced.value.trim().replace(/^#/, '')
    if (/^\d+$/.test(term)) q = q.eq('order_number', Number(term))
    else if (term) q = q.ilike('email', `%${term.replace(/[%_\\]/g, '').toLowerCase()}%`)
    if (status.value) q = q.eq('status', status.value)
    if (reviewOnly.value) q = q.eq('needs_review', true)

    const { data, count, error } = await q
    if (error) throw error
    return { rows: data ?? [], total: count ?? 0 }
  },
  { watch: [page, debounced, status, reviewOnly] },
)
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <AdminPageHeader :title="t('adm.orders.title')" />

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <label for="ord-search" class="sr-only">{{ t('adm.common.search') }}</label>
      <input id="ord-search" v-model="search" type="search" :placeholder="t('adm.orders.search_placeholder')" class="form-input max-w-xs">
      <label for="ord-status" class="sr-only">{{ t('adm.orders.col_status') }}</label>
      <select id="ord-status" v-model="status" class="form-input w-auto">
        <option value="">{{ t('adm.orders.all_statuses') }}</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ t(`adm.orders.status.${s}`) }}</option>
      </select>
      <label class="flex items-center gap-2 text-sm text-gray-700">
        <input v-model="reviewOnly" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
        {{ t('adm.orders.needs_review_only') }}
      </label>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" class="px-4 py-3">{{ t('adm.orders.col_order') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.orders.col_date') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.orders.col_customer') }}</th>
            <th scope="col" class="px-4 py-3 text-right">{{ t('adm.orders.col_total') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.orders.col_status') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.orders.col_payment') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100" :class="{ 'opacity-60': pending }">
          <tr v-for="o in data?.rows" :key="o.id" class="hover:bg-gray-50">
            <td class="whitespace-nowrap px-4 py-3">
              <NuxtLink :to="localePath(`/admin/orders/${o.id}`)" class="font-semibold text-gray-900 hover:text-brand-700">#{{ o.order_number }}</NuxtLink>
              <span v-if="o.needs_review" class="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700" :title="t('adm.orders.review_title')">!</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">{{ formatDate(o.created_at, locale, true) }}</td>
            <td class="px-4 py-3">
              <span class="block text-gray-900">{{ o.customer_name || '—' }}</span>
              <span class="block text-xs text-gray-500">{{ o.email }}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{{ formatMoney(o.total, o.currency, locale) }}</td>
            <td class="px-4 py-3"><AdminStatusBadge kind="order" :value="o.status" /></td>
            <td class="px-4 py-3"><AdminStatusBadge kind="payment" :value="o.payment_status" /></td>
          </tr>
          <tr v-if="!pending && !data?.rows.length">
            <td colspan="6" class="px-4 py-12 text-center text-gray-500">{{ t('adm.orders.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination v-model="page" :total="data?.total ?? 0" :page-size="PAGE_SIZE" />
  </div>
</template>

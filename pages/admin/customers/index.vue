<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()

useSeoMeta({ title: () => t('adm.customers.title') })

const PAGE_SIZE = 25
const page = ref(1)
const search = ref('')
watch(search, () => { page.value = 1 })

const { data: store } = await useAsyncData('adm:customers-store', async () => {
  const { data } = await supabase.from('store_settings').select('currency').eq('id', 1).single()
  return data
})
const { data: customers, pending } = await useAsyncData('adm:customers', async () => {
  const { data, error } = await supabase.rpc('admin_customers_overview')
  if (error) throw error
  return data ?? []
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const all = customers.value ?? []
  return q ? all.filter(c => c.email.toLowerCase().includes(q) || (c.full_name ?? '').toLowerCase().includes(q)) : all
})
const visible = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const currency = computed(() => store.value?.currency ?? 'CHF')

function exportCsv() {
  const csv = toCsv(filtered.value, [
    { header: t('adm.customers.col_name'), value: c => c.full_name },
    { header: t('adm.customers.col_email'), value: c => c.email },
    { header: t('adm.customers.col_language'), value: c => c.preferred_locale },
    { header: t('adm.customers.col_registered'), value: c => c.registered_at?.slice(0, 10) },
    { header: t('adm.customers.col_orders'), value: c => c.orders_count },
    { header: t('adm.customers.col_spent'), value: c => Number(c.total_spent).toFixed(2) },
    { header: t('adm.customers.col_last_order'), value: c => c.last_order_at?.slice(0, 10) },
    { header: t('adm.customers.col_newsletter'), value: c => c.newsletter_status },
  ])
  downloadCsv(`clientes_${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

const newsletterStyle: Record<string, string> = {
  subscribed: 'bg-green-50 text-green-800',
  pending: 'bg-amber-50 text-amber-800',
  unsubscribed: 'bg-gray-100 text-gray-600',
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <AdminPageHeader :title="t('adm.customers.title')" :description="t('adm.customers.intro')">
      <template #actions>
        <button type="button" class="btn-secondary" :disabled="!filtered.length" @click="exportCsv">{{ t('adm.common.export_csv') }}</button>
      </template>
    </AdminPageHeader>

    <div class="mb-4">
      <label for="cust-search" class="sr-only">{{ t('adm.common.search') }}</label>
      <input id="cust-search" v-model="search" type="search" :placeholder="t('adm.customers.search_placeholder')" class="form-input max-w-sm">
    </div>

    <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" class="px-4 py-3">{{ t('adm.customers.col_name') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.customers.col_registered') }}</th>
            <th scope="col" class="px-4 py-3 text-right">{{ t('adm.customers.col_orders') }}</th>
            <th scope="col" class="px-4 py-3 text-right">{{ t('adm.customers.col_spent') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.customers.col_last_order') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.customers.col_newsletter') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100" :class="{ 'opacity-60': pending }">
          <tr v-for="c in visible" :key="c.user_id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <span class="block font-medium text-gray-900">{{ c.full_name || '—' }} <span class="text-xs font-normal uppercase text-gray-400">{{ c.preferred_locale }}</span></span>
              <a :href="`mailto:${c.email}`" class="block text-xs text-brand-700 hover:underline">{{ c.email }}</a>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">{{ formatDate(c.registered_at, locale) }}</td>
            <td class="px-4 py-3 text-right tabular-nums">
              <NuxtLink v-if="c.orders_count > 0" :to="{ path: localePath('/admin/orders'), query: { q: c.email } }" class="font-medium text-brand-700 hover:underline">{{ c.orders_count }}</NuxtLink>
              <span v-else class="text-gray-400">0</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right tabular-nums">{{ formatMoney(c.total_spent, currency, locale) }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">{{ formatDate(c.last_order_at, locale) }}</td>
            <td class="px-4 py-3">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="newsletterStyle[c.newsletter_status] ?? 'text-gray-400'">
                {{ t(`adm.customers.newsletter.${c.newsletter_status}`, c.newsletter_status) }}
              </span>
            </td>
          </tr>
          <tr v-if="!pending && !filtered.length">
            <td colspan="6" class="px-4 py-12 text-center text-gray-500">{{ t('adm.customers.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination v-model="page" :total="filtered.length" :page-size="PAGE_SIZE" />
  </div>
</template>

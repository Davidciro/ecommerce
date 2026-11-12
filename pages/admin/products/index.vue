<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const publicUrl = useStorageUrl()

useSeoMeta({ title: () => t('adm.products.title') })

const PAGE_SIZE = 20
const page = ref(1)
const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('all')
const debounced = refDebounced(search, 300)
watch([debounced, status], () => { page.value = 1 })

/** Elimina caracteres con significado en los filtros de PostgREST. */
function sanitize(q: string) {
  return q.replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 80)
}

const { data: store } = await useAsyncData('adm:currency', async () => {
  const { data } = await supabase.from('store_settings').select('currency, low_stock_threshold').eq('id', 1).single()
  return data
})

const { data, pending } = await useAsyncData(
  'adm:products',
  async () => {
    let q = supabase
      .from('products')
      .select('id, name, sku, sale_price, stock, is_active, is_featured, updated_at, product_images(storage_path, position)', { count: 'exact' })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE - 1)

    const term = sanitize(debounced.value)
    if (term) {
      q = q.or(`name->>fr.ilike.*${term}*,name->>de.ilike.*${term}*,name->>es.ilike.*${term}*,sku.ilike.*${term}*`)
    }
    if (status.value !== 'all') q = q.eq('is_active', status.value === 'active')

    const { data, count, error } = await q
    if (error) throw error
    return { rows: data ?? [], total: count ?? 0 }
  },
  { watch: [page, debounced, status] },
)

function thumb(images: { storage_path: string, position: number }[] | null) {
  const first = [...(images ?? [])].sort((a, b) => a.position - b.position)[0]
  return first ? publicUrl('product-images', first.storage_path) : null
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <AdminPageHeader :title="t('adm.products.title')">
      <template #actions>
        <NuxtLink :to="localePath('/admin/products/new')" class="btn-primary">+ {{ t('adm.products.new') }}</NuxtLink>
      </template>
    </AdminPageHeader>

    <div class="mb-4 flex flex-wrap gap-3">
      <label class="sr-only" for="prod-search">{{ t('adm.common.search') }}</label>
      <input id="prod-search" v-model="search" type="search" :placeholder="t('adm.products.search_placeholder')" class="form-input max-w-sm">
      <label class="sr-only" for="prod-status">{{ t('adm.products.col_status') }}</label>
      <select id="prod-status" v-model="status" class="form-input w-auto">
        <option value="all">{{ t('adm.common.all') }}</option>
        <option value="active">{{ t('adm.common.active') }}</option>
        <option value="inactive">{{ t('adm.common.inactive') }}</option>
      </select>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" class="px-4 py-3">{{ t('adm.products.col_product') }}</th>
            <th scope="col" class="px-4 py-3 text-right">{{ t('adm.products.col_price') }}</th>
            <th scope="col" class="px-4 py-3 text-right">{{ t('adm.products.col_stock') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.products.col_status') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100" :class="{ 'opacity-60': pending }">
          <tr v-for="p in data?.rows" :key="p.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <NuxtLink :to="localePath(`/admin/products/${p.id}`)" class="flex items-center gap-3">
                <span class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <img v-if="thumb(p.product_images)" :src="thumb(p.product_images)!" alt="" class="h-full w-full object-cover" loading="lazy">
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-medium text-gray-900">{{ pickLocalized(p.name, locale) || '—' }}</span>
                  <span v-if="p.sku" class="block text-xs text-gray-500">{{ p.sku }}</span>
                </span>
              </NuxtLink>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right tabular-nums">{{ formatMoney(p.sale_price, store?.currency ?? 'CHF', locale) }}</td>
            <td class="px-4 py-3 text-right tabular-nums" :class="p.stock <= (store?.low_stock_threshold ?? 5) ? 'font-semibold text-amber-700' : ''">{{ p.stock }}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-2">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="p.is_active ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'">
                  {{ p.is_active ? t('adm.common.active') : t('adm.common.inactive') }}
                </span>
                <span v-if="p.is_featured" class="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">★ {{ t('adm.products.featured') }}</span>
              </span>
            </td>
          </tr>
          <tr v-if="!pending && !data?.rows.length">
            <td colspan="4" class="px-4 py-12 text-center text-gray-500">{{ t('adm.products.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AdminPagination v-model="page" :total="data?.total ?? 0" :page-size="PAGE_SIZE" />
  </div>
</template>

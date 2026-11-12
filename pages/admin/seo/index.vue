<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()

useSeoMeta({ title: () => t('adm.seo.title') })

const { data: pages } = await useAsyncData('adm:seo', async () => {
  const { data, error } = await supabase
    .from('seo_pages')
    .select('id, page_key, route_path, meta_title, meta_description, keywords, noindex, include_in_sitemap')
    .order('sitemap_priority', { ascending: false })
    .order('page_key')
  if (error) throw error
  return data ?? []
})

function missing(p: { meta_title: unknown, meta_description: unknown }) {
  const s = new Set([...missingLocales(p.meta_title), ...missingLocales(p.meta_description)])
  return [...s].map(l => l.toUpperCase())
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <AdminPageHeader :title="t('adm.seo.title')" :description="t('adm.seo.intro')">
      <template #actions>
        <NuxtLink :to="localePath('/admin/seo/new')" class="btn-primary">+ {{ t('adm.seo.new') }}</NuxtLink>
      </template>
    </AdminPageHeader>

    <p class="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{{ t('adm.seo.products_hint') }}</p>

    <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" class="px-4 py-3">{{ t('adm.seo.col_page') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.seo.col_route') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.seo.col_completion') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.seo.col_status') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="p in pages" :key="p.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <NuxtLink :to="localePath(`/admin/seo/${p.id}`)" class="font-medium text-gray-900 hover:text-brand-700">{{ p.page_key }}</NuxtLink>
            </td>
            <td class="px-4 py-3"><code class="text-xs text-gray-600">{{ p.route_path }}</code></td>
            <td class="px-4 py-3">
              <span v-if="missing(p).length" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                {{ t('adm.common.missing_translation', { locales: missing(p).join(', ') }) }}
              </span>
              <span v-else class="text-xs font-medium text-green-700">FR · DE · ES ✓</span>
            </td>
            <td class="px-4 py-3">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="p.noindex ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-800'">
                {{ p.noindex ? t('adm.seo.noindex') : t('adm.seo.indexed') }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

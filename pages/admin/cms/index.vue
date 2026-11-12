<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()

useSeoMeta({ title: () => t('adm.cms.title') })

const PAGES = ['global', 'home', 'about', 'products', 'legal'] as const

const { data: sections } = await useAsyncData('adm:cms', async () => {
  const { data, error } = await supabase
    .from('site_sections')
    .select('id, key, page, content, is_published, updated_at, sort_order')
    .order('sort_order')
  if (error) throw error
  return data ?? []
})

const grouped = computed(() =>
  PAGES.map(page => ({ page, items: (sections.value ?? []).filter(s => s.page === page) })).filter(g => g.items.length),
)

/** Idiomas con algún campo vacío en la sección. */
function missing(content: unknown): string[] {
  const c = (content ?? {}) as Record<string, unknown>
  const out = new Set<string>()
  for (const v of Object.values(c)) for (const l of missingLocales(v)) out.add(l.toUpperCase())
  return [...out]
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <AdminPageHeader :title="t('adm.cms.title')" :description="t('adm.cms.intro')" />

    <div class="space-y-8">
      <section v-for="group in grouped" :key="group.page" :aria-labelledby="`cms-${group.page}`">
        <h2 :id="`cms-${group.page}`" class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t(`adm.cms.pages.${group.page}`) }}
        </h2>
        <ul class="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <li v-for="s in group.items" :key="s.id">
            <NuxtLink :to="localePath(`/admin/cms/${s.key}`)" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50">
              <span>
                <span class="block font-medium text-gray-900">{{ t(`adm.cms.sections.${s.key}`, s.key) }}</span>
                <span class="block text-xs text-gray-500">{{ t('adm.cms.updated', { date: formatDate(s.updated_at, locale, true) }) }}</span>
              </span>
              <span class="flex items-center gap-2">
                <span v-if="missing(s.content).length" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {{ t('adm.common.missing_translation', { locales: missing(s.content).join(', ') }) }}
                </span>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="s.is_published ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'">
                  {{ s.is_published ? t('adm.cms.published') : t('adm.cms.unpublished') }}
                </span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

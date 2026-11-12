<script setup lang="ts">
import type { Database } from '~/types/database.types'
import {
  LOCALES, emptyLocalized, emptyLocalizedArray, toLocalized, toLocalizedArray,
  type Locale, type Localized,
} from '~/utils/localized'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  validate: route => route.params.id === 'new' || /^[0-9a-f-]{36}$/i.test(String(route.params.id)),
})

const { t, locale: uiLocale } = useI18n()
const route = useRoute()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const toast = useToast()
const config = useRuntimeConfig()

const id = String(route.params.id)
const isNew = id === 'new'
const CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const
type ChangeFreq = (typeof CHANGEFREQ)[number]

useSeoMeta({ title: () => t('adm.seo.title') })

const form = reactive({
  page_key: '',
  route_path: '/',
  meta_title: emptyLocalized(),
  meta_description: emptyLocalized(),
  keywords: emptyLocalizedArray(),
  og_image_path: null as string | null,
  noindex: false,
  include_in_sitemap: true,
  sitemap_changefreq: 'weekly' as ChangeFreq,
  sitemap_priority: 0.5,
})

if (!isNew) {
  const { data, error } = await supabase.from('seo_pages').select('*').eq('id', id).maybeSingle()
  if (error || !data) throw createError({ statusCode: 404, statusMessage: 'SEO page not found' })
  Object.assign(form, {
    page_key: data.page_key,
    route_path: data.route_path,
    meta_title: toLocalized(data.meta_title),
    meta_description: toLocalized(data.meta_description),
    keywords: toLocalizedArray(data.keywords),
    og_image_path: data.og_image_path,
    noindex: data.noindex,
    include_in_sitemap: data.include_in_sitemap,
    sitemap_changefreq: data.sitemap_changefreq as ChangeFreq,
    sitemap_priority: Number(data.sitemap_priority),
  })
}

const editLocale = ref<Locale>((LOCALES as readonly string[]).includes(uiLocale.value) ? (uiLocale.value as Locale) : 'fr')
const incomplete = computed(() => {
  const out: Partial<Record<Locale, boolean>> = {}
  for (const l of LOCALES) out[l] = !form.meta_title[l].trim() || !form.meta_description[l].trim()
  return out
})
const keywords = computed<string[]>({
  get: () => form.keywords[editLocale.value],
  set: v => { form.keywords = { ...form.keywords, [editLocale.value]: v } as Localized<string[]> },
})

// Vista previa tipo Google
const previewUrl = computed(() => {
  const base = String(config.public.siteUrl).replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `${base} › ${editLocale.value}${form.route_path === '/' ? '' : form.route_path.replace(/\//g, ' › ')}`
})
const previewTitle = computed(() => form.meta_title[editLocale.value] || form.page_key)
const previewDesc = computed(() => {
  const d = form.meta_description[editLocale.value]
  return d.length > 160 ? `${d.slice(0, 157)}…` : d
})

// Guardado
const saving = ref(false)
const errorKey = ref<string | null>(null)

async function save() {
  errorKey.value = null
  if (!/^[a-z0-9_]+$/.test(form.page_key)) {
    errorKey.value = 'adm.seo.errors.invalid_key'
    return
  }
  if (!/^\/[a-z0-9/_-]*$/.test(form.route_path)) {
    errorKey.value = 'adm.seo.errors.invalid_route'
    return
  }
  saving.value = true
  const payload = {
    page_key: form.page_key,
    route_path: form.route_path,
    meta_title: form.meta_title,
    meta_description: form.meta_description,
    keywords: form.keywords,
    og_image_path: form.og_image_path,
    noindex: form.noindex,
    include_in_sitemap: form.noindex ? false : form.include_in_sitemap,
    sitemap_changefreq: form.sitemap_changefreq,
    sitemap_priority: Math.min(1, Math.max(0, Math.round(form.sitemap_priority * 10) / 10)),
  }
  const { data, error } = isNew
    ? await supabase.from('seo_pages').insert(payload).select('id').single()
    : await supabase.from('seo_pages').update(payload).eq('id', id).select('id').single()
  saving.value = false

  if (error) {
    errorKey.value = error.code === '23505' ? 'adm.seo.errors.duplicate' : 'adm.common.error'
    return
  }
  if (isNew) {
    toast.success(t('adm.seo.created'))
    await navigateTo(localePath(`/admin/seo/${data.id}`), { replace: true })
  }
  else {
    toast.success(t('adm.common.saved'))
  }
}

async function remove() {
  if (!confirm(t('adm.seo.confirm_delete', { key: form.page_key }))) return
  const { error } = await supabase.from('seo_pages').delete().eq('id', id)
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  toast.success(t('adm.seo.deleted'))
  await navigateTo(localePath('/admin/seo'))
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <AdminPageHeader :title="isNew ? t('adm.seo.new') : form.page_key" :back-to="localePath('/admin/seo')">
      <template #actions>
        <AdminLocaleTabs v-model="editLocale" :incomplete="incomplete" />
      </template>
    </AdminPageHeader>

    <form class="space-y-8" novalidate @submit.prevent="save">
      <div v-if="errorKey" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ t(errorKey) }}</div>

      <section class="card grid gap-5 sm:grid-cols-2">
        <div>
          <label for="seo-key" class="form-label">{{ t('adm.seo.page_key') }}</label>
          <input id="seo-key" v-model.trim="form.page_key" type="text" maxlength="60" class="form-input font-mono">
          <p class="mt-1 text-xs text-gray-500">{{ t('adm.seo.page_key_hint') }}</p>
        </div>
        <div>
          <label for="seo-route" class="form-label">{{ t('adm.seo.route_path') }}</label>
          <input id="seo-route" v-model.trim="form.route_path" type="text" maxlength="200" class="form-input font-mono">
          <p class="mt-1 text-xs text-gray-500">{{ t('adm.seo.route_path_hint') }}</p>
        </div>
      </section>

      <section class="card space-y-5">
        <AdminLocalizedField id="seo-title" v-model="form.meta_title" :label="t('adm.seo.meta_title')" :locale="editLocale" :maxlength="120" :recommended="60" />
        <AdminLocalizedField id="seo-desc" v-model="form.meta_description" :label="t('adm.seo.meta_description')" :locale="editLocale" multiline :rows="3" :maxlength="320" :recommended="160" />
        <AdminKeywordsInput :id="`seo-kw-${editLocale}`" v-model="keywords" :label="`${t('adm.seo.keywords')} (${editLocale.toUpperCase()})`" :hint="t('adm.seo.keywords_hint')" />

        <!-- Vista previa en Google -->
        <div>
          <p class="form-label">{{ t('adm.seo.preview') }}</p>
          <div class="rounded-xl border border-gray-200 p-4 font-sans">
            <p class="truncate text-xs text-gray-600">{{ previewUrl }}</p>
            <p class="truncate text-lg text-[#1a0dab]">{{ previewTitle }}</p>
            <p class="line-clamp-2 text-sm text-gray-700">{{ previewDesc }}</p>
          </div>
        </div>
      </section>

      <section class="card space-y-5">
        <AdminImageField id="seo-og" v-model="form.og_image_path" :label="t('adm.seo.og_image')" folder="seo" :max-size="1200" />
      </section>

      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.seo.sitemap_section') }}</h2>
        <label class="flex items-center gap-3">
          <input v-model="form.noindex" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
          <span class="text-sm font-medium text-gray-800">{{ t('adm.seo.noindex_label') }}</span>
        </label>
        <label class="flex items-center gap-3" :class="form.noindex ? 'opacity-50' : ''">
          <input v-model="form.include_in_sitemap" type="checkbox" :disabled="form.noindex" class="h-4 w-4 rounded border-gray-300 text-brand-600">
          <span class="text-sm font-medium text-gray-800">{{ t('adm.seo.include_in_sitemap') }}</span>
        </label>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="seo-freq" class="form-label">{{ t('adm.seo.changefreq') }}</label>
            <select id="seo-freq" v-model="form.sitemap_changefreq" class="form-input">
              <option v-for="f in CHANGEFREQ" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>
          <div>
            <label for="seo-prio" class="form-label">{{ t('adm.seo.priority') }}</label>
            <input id="seo-prio" v-model.number="form.sitemap_priority" type="number" min="0" max="1" step="0.1" class="form-input">
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <button v-if="!isNew" type="button" class="btn-ghost text-red-600" @click="remove">{{ t('adm.common.delete') }}</button>
        <span v-else />
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? t('adm.common.saving') : t('adm.common.save') }}</button>
      </div>
    </form>
  </div>
</template>

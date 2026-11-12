<script setup lang="ts">
import type { Database, Json } from '~/types/database.types'
import { LOCALES, toLocalized, type Locale, type Localized } from '~/utils/localized'
import { getPath, schemaFor, setPath, type SettingField } from '~/utils/cms-schema'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  validate: route => /^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(String(route.params.key)),
})

const { t, locale: uiLocale } = useI18n()
const route = useRoute()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const toast = useToast()

const key = String(route.params.key)
useSeoMeta({ title: () => `${t(`adm.cms.sections.${key}`, key)} · ${t('adm.cms.title')}` })

const { data: section } = await useAsyncData(`adm:cms:${key}`, async () => {
  const { data, error } = await supabase.from('site_sections').select('*').eq('key', key).maybeSingle()
  if (error) throw error
  return data
})
if (!section.value) throw createError({ statusCode: 404, statusMessage: 'Section not found' })

const rawContent = (section.value.content ?? {}) as Record<string, unknown>
const schema = schemaFor(key, rawContent)

// Contenido localizado: un objeto {fr,de,es} por campo del esquema
const content = reactive<Record<string, Localized>>(
  Object.fromEntries(schema.content.map(f => [f.key, toLocalized(rawContent[f.key])])),
)
const settings = ref<Record<string, unknown>>({ ...((section.value.settings ?? {}) as Record<string, unknown>) })
const isPublished = ref(section.value.is_published)
const editLocale = ref<Locale>((LOCALES as readonly string[]).includes(uiLocale.value) ? (uiLocale.value as Locale) : 'fr')

const incomplete = computed(() => {
  const out: Partial<Record<Locale, boolean>> = {}
  for (const l of LOCALES) out[l] = Object.values(content).some(v => !v[l].trim())
  return out
})

// ---- Ajustes no traducibles ------------------------------------------------
function settingValue(f: SettingField) {
  const v = getPath(settings.value, f.path)
  if (f.type === 'lines') return Array.isArray(v) ? v.join('\n') : ''
  if (f.type === 'boolean') return Boolean(v)
  if (f.type === 'number') return v === null || v === undefined ? '' : v
  return (v as string | null) ?? ''
}
function setSetting(f: SettingField, raw: unknown) {
  let value: unknown = raw
  if (f.type === 'lines') value = String(raw).split('\n').map(s => s.trim()).filter(Boolean)
  else if (f.type === 'number') value = raw === '' || raw === null ? null : Number(raw)
  else if (f.type === 'image') value = raw || null
  else if (f.type === 'date') value = raw || null
  settings.value = setPath(settings.value, f.path, value)
}
function fieldId(f: SettingField) {
  return `set-${f.path.join('-')}`
}

// ---- Guardado ---------------------------------------------------------------
const saving = ref(false)
const errorMsg = ref<string | null>(null)

function validate(): string | null {
  for (const f of schema.settings) {
    const v = getPath(settings.value, f.path)
    if (f.type === 'url' && v && !/^https:\/\/[^\s]+$/.test(String(v))) return `${t(`adm.cms.fields.${f.label}`)}: https://…`
    if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) return `${t(`adm.cms.fields.${f.label}`)}: ${t('auth.errors.invalid_email')}`
    if (f.type === 'number' && v !== null && v !== undefined && !Number.isFinite(Number(v))) return `${t(`adm.cms.fields.${f.label}`)}: ${t('adm.common.error')}`
  }
  return null
}

async function save() {
  errorMsg.value = validate()
  if (errorMsg.value) return
  saving.value = true
  const { error } = await supabase
    .from('site_sections')
    .update({
      content: { ...rawContent, ...content } as unknown as Json,
      settings: settings.value as Json,
      is_published: isPublished.value,
    })
    .eq('key', key)
  saving.value = false
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  toast.success(t('adm.common.saved'))
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <AdminPageHeader :title="t(`adm.cms.sections.${key}`, key)" :back-to="localePath('/admin/cms')">
      <template #actions>
        <AdminLocaleTabs v-model="editLocale" :incomplete="incomplete" />
      </template>
    </AdminPageHeader>

    <form class="space-y-8" novalidate @submit.prevent="save">
      <div v-if="errorMsg" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMsg }}</div>

      <section v-if="schema.content.length" class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.cms.content_title') }}</h2>
        <template v-for="f in schema.content" :key="f.key">
          <AdminLocalizedField
            :id="`c-${f.key}`"
            v-model="content[f.key]!"
            :label="t(`adm.cms.fields.${f.key}`, f.key)"
            :locale="editLocale"
            :multiline="f.type !== 'text'"
            :rows="f.type === 'markdown' ? 14 : 4"
            :maxlength="f.max"
            :hint="f.type === 'markdown' ? t('adm.cms.markdown_hint') : undefined"
          />
        </template>
      </section>

      <section v-if="schema.settings.length" class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.cms.settings_title') }}</h2>
        <div class="grid gap-5 sm:grid-cols-2">
          <div v-for="f in schema.settings" :key="fieldId(f)" :class="['image', 'lines', 'url'].includes(f.type) ? 'sm:col-span-2' : ''">
            <AdminImageField
              v-if="f.type === 'image'"
              :id="fieldId(f)"
              :model-value="(settingValue(f) as string) || null"
              :label="t(`adm.cms.fields.${f.label}`)"
              :folder="`cms/${key.replace('.', '-')}`"
              @update:model-value="setSetting(f, $event)"
            />
            <label v-else-if="f.type === 'boolean'" class="flex items-center gap-3">
              <input :id="fieldId(f)" type="checkbox" :checked="Boolean(settingValue(f))" class="h-4 w-4 rounded border-gray-300 text-brand-600" @change="setSetting(f, ($event.target as HTMLInputElement).checked)">
              <span class="text-sm font-medium text-gray-800">{{ t(`adm.cms.fields.${f.label}`) }}</span>
            </label>
            <template v-else>
              <label :for="fieldId(f)" class="form-label">{{ t(`adm.cms.fields.${f.label}`) }}</label>
              <textarea
                v-if="f.type === 'lines'"
                :id="fieldId(f)"
                :value="settingValue(f) as string"
                rows="3"
                class="form-input"
                @input="setSetting(f, ($event.target as HTMLTextAreaElement).value)"
              />
              <input
                v-else
                :id="fieldId(f)"
                :value="settingValue(f)"
                :type="f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'"
                :step="f.type === 'number' ? 'any' : undefined"
                class="form-input"
                @input="setSetting(f, ($event.target as HTMLInputElement).value)"
              >
              <p v-if="f.hint" class="mt-1 text-xs text-gray-500">{{ t(`adm.cms.fields.${f.hint}`) }}</p>
            </template>
          </div>
        </div>
      </section>

      <section class="card">
        <label class="flex items-center gap-3">
          <input v-model="isPublished" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
          <span class="text-sm font-medium text-gray-800">{{ t('adm.cms.is_published') }}</span>
        </label>
      </section>

      <div class="flex justify-end">
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? t('adm.common.saving') : t('adm.common.save') }}</button>
      </div>
    </form>
  </div>
</template>

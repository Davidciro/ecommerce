<script setup lang="ts">
import type { Database, Json } from '~/types/database.types'
import { LOCALES, emptyLocalized, toLocalized, type Locale } from '~/utils/localized'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  validate: route => route.params.id === 'new' || /^[0-9a-f-]{36}$/i.test(String(route.params.id)),
})

type SegmentType = 'all_subscribers' | 'customers' | 'customers_with_orders' | 'customers_without_orders'
const SEGMENTS: SegmentType[] = ['all_subscribers', 'customers', 'customers_with_orders', 'customers_without_orders']
const UNSUBSCRIBE_PLACEHOLDER = '{{unsubscribe_url}}'

const { t, locale: uiLocale } = useI18n()
const route = useRoute()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const toast = useToast()
const { user } = useAuth()

const id = String(route.params.id)
const isNew = id === 'new'

useSeoMeta({ title: () => t('adm.campaigns.title') })

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const form = reactive({
  name: '',
  subject: emptyLocalized(),
  preheader: emptyLocalized(),
  body_html: emptyLocalized(),
  body_text: emptyLocalized(),
  segmentType: 'all_subscribers' as SegmentType,
  segmentLocales: [] as Locale[],
})
const status = ref<string>('draft')
const result = ref({ recipients: 0, sent: 0, failed: 0, sentAt: null as string | null })

if (!isNew) {
  const { data, error } = await supabase.from('email_campaigns').select('*').eq('id', id).maybeSingle()
  if (error || !data) throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })
  const seg = (data.segment ?? {}) as { type?: SegmentType, locales?: Locale[] }
  Object.assign(form, {
    name: data.name,
    subject: toLocalized(data.subject),
    preheader: toLocalized(data.preheader),
    body_html: toLocalized(data.body_html),
    body_text: toLocalized(data.body_text),
    segmentType: seg.type ?? 'all_subscribers',
    segmentLocales: seg.locales ?? [],
  })
  status.value = data.status
  result.value = { recipients: data.recipients_count, sent: data.sent_count, failed: data.failed_count, sentAt: data.sent_at }
}

const readonly = computed(() => status.value !== 'draft')
const editLocale = ref<Locale>((LOCALES as readonly string[]).includes(uiLocale.value) ? (uiLocale.value as Locale) : 'fr')
const incomplete = computed(() => {
  const out: Partial<Record<Locale, boolean>> = {}
  for (const l of LOCALES) out[l] = !form.subject[l].trim() || !form.body_html[l].trim()
  return out
})
const segment = computed(() => {
  const s: { type: SegmentType, locales?: Locale[] } = { type: form.segmentType }
  if (form.segmentLocales.length && form.segmentLocales.length < LOCALES.length) s.locales = [...form.segmentLocales]
  return s
})

// ---------------------------------------------------------------------------
// Audiencia
// ---------------------------------------------------------------------------
const audience = ref<number | null>(null)
const countingAudience = ref(false)
async function countAudience() {
  countingAudience.value = true
  const { data, error } = await supabase.rpc('admin_campaign_audience', { p_segment: segment.value as unknown as Json })
  countingAudience.value = false
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  audience.value = data?.length ?? 0
}
watch(segment, () => { audience.value = null }, { deep: true })

// ---------------------------------------------------------------------------
// Vista previa (iframe sandbox sin scripts)
// ---------------------------------------------------------------------------
const previewHtml = computed(() => {
  const body = form.body_html[editLocale.value] || '<p style="color:#999">—</p>'
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#18181b;padding:16px;margin:0}</style></head><body>${body.split(UNSUBSCRIBE_PLACEHOLDER).join('#')}</body></html>`
})

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------
const saving = ref(false)
const errorKey = ref<string | null>(null)

async function save(): Promise<string | null> {
  errorKey.value = null
  if (!form.name.trim()) {
    errorKey.value = 'adm.common.required'
    return null
  }
  saving.value = true
  const payload = {
    name: form.name.trim(),
    subject: form.subject,
    preheader: form.preheader,
    body_html: form.body_html,
    body_text: form.body_text,
    segment: segment.value as unknown as Json,
  }
  const res = isNew
    ? await supabase.from('email_campaigns').insert({ ...payload, created_by: (user.value?.sub as string) ?? null }).select('id').single()
    : await supabase.from('email_campaigns').update(payload).eq('id', id).eq('status', 'draft').select('id').single()
  saving.value = false
  if (res.error) {
    toast.error(t('adm.common.error'))
    return null
  }
  if (isNew) {
    toast.success(t('adm.common.saved'))
    await navigateTo(localePath(`/admin/campaigns/${res.data.id}`), { replace: true })
  }
  else {
    toast.success(t('adm.common.saved'))
  }
  return res.data.id
}

function apiError(err: unknown): string {
  const msg = (err as { statusMessage?: string }).statusMessage ?? ''
  const known = ['resend_not_configured', 'audience_empty', 'campaign_empty', 'campaign_not_draft']
  return known.includes(msg) ? t(`adm.campaigns.errors.${msg}`) : t('adm.common.error')
}

const testing = ref(false)
async function sendTest() {
  const savedId = await save()
  if (!savedId) return
  testing.value = true
  try {
    const res = await $fetch(`/api/admin/campaigns/${savedId}/test`, { method: 'POST', body: { locale: editLocale.value } })
    if (res.ok) toast.success(t('adm.campaigns.test_sent', { email: res.to }))
    else toast.error(res.error ?? t('adm.common.error'))
  }
  catch (err) {
    toast.error(apiError(err))
  }
  finally {
    testing.value = false
  }
}

const sending = ref(false)
async function send() {
  const savedId = await save()
  if (!savedId) return
  await countAudience()
  if (!audience.value) {
    toast.error(t('adm.campaigns.errors.audience_empty'))
    return
  }
  if (!confirm(t('adm.campaigns.confirm_send', { count: audience.value }))) return
  sending.value = true
  try {
    const res = await $fetch(`/api/admin/campaigns/${savedId}/send`, { method: 'POST' })
    status.value = res.status
    result.value = { recipients: res.recipients, sent: res.sent, failed: res.failed, sentAt: new Date().toISOString() }
    if (res.ok) toast.success(t('adm.campaigns.sent_result', { sent: res.sent, failed: res.failed }))
    else toast.error(t('adm.campaigns.sent_result', { sent: res.sent, failed: res.failed }))
  }
  catch (err) {
    toast.error(apiError(err))
  }
  finally {
    sending.value = false
  }
}

async function remove() {
  if (!confirm(t('adm.campaigns.confirm_delete'))) return
  const { error } = await supabase.from('email_campaigns').delete().eq('id', id).eq('status', 'draft')
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  await navigateTo(localePath('/admin/campaigns'))
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <AdminPageHeader :title="isNew ? t('adm.campaigns.new') : form.name" :back-to="localePath('/admin/campaigns')">
      <template #actions>
        <AdminStatusBadge v-if="!isNew" kind="campaign" :value="status" />
        <AdminLocaleTabs v-model="editLocale" :incomplete="incomplete" />
      </template>
    </AdminPageHeader>

    <div v-if="readonly" role="status" class="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <p class="font-medium">{{ t('adm.campaigns.readonly') }}</p>
      <p class="mt-1">{{ t('adm.campaigns.sent_result', { sent: result.sent, failed: result.failed }) }} · {{ formatDate(result.sentAt, uiLocale, true) }}</p>
    </div>

    <div v-if="errorKey" role="alert" class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ t(errorKey) }}</div>

    <div class="grid gap-6 lg:grid-cols-2">
      <form class="space-y-6" novalidate @submit.prevent="save">
        <fieldset :disabled="readonly" class="space-y-6">
          <section class="card space-y-5">
            <div>
              <label for="c-name" class="form-label">{{ t('adm.campaigns.name') }} *</label>
              <input id="c-name" v-model="form.name" type="text" maxlength="200" class="form-input">
            </div>
            <AdminLocalizedField id="c-subject" v-model="form.subject" :label="t('adm.campaigns.subject')" :locale="editLocale" :maxlength="200" :recommended="60" />
            <AdminLocalizedField id="c-pre" v-model="form.preheader" :label="t('adm.campaigns.preheader')" :locale="editLocale" :maxlength="200" :hint="t('adm.campaigns.preheader_hint')" />
            <AdminLocalizedField
              id="c-html"
              v-model="form.body_html"
              :label="t('adm.campaigns.body_html')"
              :locale="editLocale"
              multiline
              :rows="14"
              :maxlength="100000"
              :hint="t('adm.campaigns.body_html_hint', { placeholder: UNSUBSCRIBE_PLACEHOLDER })"
            />
            <AdminLocalizedField id="c-text" v-model="form.body_text" :label="t('adm.campaigns.body_text')" :locale="editLocale" multiline :rows="6" :maxlength="50000" :hint="t('adm.campaigns.body_text_hint')" />
          </section>

          <section class="card space-y-5">
            <div>
              <label for="c-segment" class="form-label">{{ t('adm.campaigns.segment') }}</label>
              <select id="c-segment" v-model="form.segmentType" class="form-input">
                <option v-for="s in SEGMENTS" :key="s" :value="s">{{ t(`adm.campaigns.segment_type.${s}`) }}</option>
              </select>
            </div>
            <fieldset>
              <legend class="form-label">{{ t('adm.campaigns.segment_locales') }}</legend>
              <div class="flex flex-wrap gap-4">
                <label v-for="l in LOCALES" :key="l" class="flex items-center gap-2 text-sm">
                  <input v-model="form.segmentLocales" type="checkbox" :value="l" class="h-4 w-4 rounded border-gray-300 text-brand-600">
                  {{ l.toUpperCase() }}
                </label>
              </div>
              <p class="mt-1 text-xs text-gray-500">{{ form.segmentLocales.length ? '' : t('adm.campaigns.all_locales') }}</p>
            </fieldset>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-secondary" :disabled="countingAudience" @click="countAudience">{{ t('adm.campaigns.refresh_audience') }}</button>
              <span v-if="audience !== null" class="text-sm font-medium text-gray-800">{{ t('adm.campaigns.audience', { count: audience }) }}</span>
            </div>
          </section>
        </fieldset>

        <div v-if="!readonly" class="flex flex-wrap items-center justify-between gap-3">
          <button v-if="!isNew" type="button" class="btn-ghost text-red-600" @click="remove">{{ t('adm.common.delete') }}</button>
          <span v-else />
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn-secondary" :disabled="saving">{{ saving ? t('adm.common.saving') : t('adm.common.save') }}</button>
            <button type="button" class="btn-secondary" :disabled="testing || saving" @click="sendTest">{{ t('adm.campaigns.send_test') }}</button>
            <button type="button" class="btn-primary" :disabled="sending || saving" @click="send">
              {{ sending ? t('adm.campaigns.sending') : t('adm.campaigns.send') }}
            </button>
          </div>
        </div>
      </form>

      <!-- Vista previa -->
      <section class="lg:sticky lg:top-6 lg:self-start" aria-labelledby="c-preview">
        <h2 id="c-preview" class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {{ t('adm.campaigns.preview') }} ({{ editLocale.toUpperCase() }})
        </h2>
        <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div class="border-b border-gray-200 px-4 py-3 text-sm">
            <p class="font-semibold text-gray-900">{{ form.subject[editLocale] || '—' }}</p>
            <p class="truncate text-gray-500">{{ form.preheader[editLocale] }}</p>
          </div>
          <iframe :srcdoc="previewHtml" sandbox="" :title="t('adm.campaigns.preview')" class="h-[600px] w-full" />
        </div>
      </section>
    </div>
  </div>
</template>

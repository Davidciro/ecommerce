<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type Settings = Database['public']['Tables']['store_settings']['Row']
type Currency = Database['public']['Enums']['currency_code']

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

useSeoMeta({ title: () => t('adm.settings.title') })

const PAYMENT_METHODS = ['card', 'twint', 'paypal', 'klarna', 'sepa_debit'] as const
const PK_PATTERN = /^pk_(test|live)_[A-Za-z0-9]+$/
const SK_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/
const WH_PATTERN = /^whsec_[A-Za-z0-9]+$/

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------
const { data: settings, refresh } = await useAsyncData('adm:settings', async () => {
  const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
})
const { data: secretStatus, refresh: refreshSecrets } = await useAsyncData('adm:stripe-status', async () => {
  const { data } = await supabase.rpc('admin_get_stripe_secrets_status')
  return data?.[0] ?? null
})
const { data: integrations } = await useFetch('/api/admin/integrations', { key: 'adm:integrations' })

// ---------------------------------------------------------------------------
// Formulario de tienda
// ---------------------------------------------------------------------------
function toForm(s: Settings | null | undefined) {
  return {
    store_name: s?.store_name ?? '',
    legal_name: s?.legal_name ?? '',
    vat_number: s?.vat_number ?? '',
    contact_email: s?.contact_email ?? '',
    default_locale: s?.default_locale ?? 'fr',
    currency: (s?.currency ?? 'CHF') as Currency,
    vat_rate: Number(s?.vat_rate ?? 8.1),
    prices_include_vat: s?.prices_include_vat ?? true,
    shipping_fee: Number(s?.shipping_fee ?? 0),
    free_shipping_threshold: s?.free_shipping_threshold === null || s?.free_shipping_threshold === undefined ? '' : String(s.free_shipping_threshold),
    shipping_countries: (s?.shipping_countries ?? ['CH']).join(', '),
    payment_methods: [...(s?.payment_methods ?? ['card'])],
    stripe_publishable_key: s?.stripe_publishable_key ?? '',
    low_stock_threshold: s?.low_stock_threshold ?? 5,
    max_quantity_per_item: s?.max_quantity_per_item ?? 20,
  }
}
const form = reactive(toForm(settings.value))
const saving = ref(false)
const errors = ref<Record<string, string>>({})

watch(() => form.currency, (c) => {
  if (c !== 'CHF') form.payment_methods = form.payment_methods.filter(m => m !== 'twint')
})

function validate() {
  const e: Record<string, string> = {}
  if (!form.store_name.trim()) e.store_name = t('adm.common.required')
  if (!(form.vat_rate >= 0 && form.vat_rate < 100)) e.vat_rate = t('adm.common.error')
  if (!(form.shipping_fee >= 0)) e.shipping_fee = t('adm.products.errors.invalid_price')
  if (form.free_shipping_threshold !== '' && !(Number(form.free_shipping_threshold) >= 0)) e.free_shipping_threshold = t('adm.products.errors.invalid_price')
  const countries = form.shipping_countries.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  if (!countries.length || countries.some(c => !/^[A-Z]{2}$/.test(c))) e.shipping_countries = t('adm.settings.shipping_countries_hint')
  if (!form.payment_methods.length) e.payment_methods = t('adm.common.required')
  if (form.payment_methods.includes('twint') && form.currency !== 'CHF') e.payment_methods = t('adm.settings.twint_requires_chf')
  if (form.stripe_publishable_key && !PK_PATTERN.test(form.stripe_publishable_key.trim())) e.stripe_publishable_key = t('adm.settings.errors.invalid_format')
  errors.value = e
  return { ok: Object.keys(e).length === 0, countries }
}

async function save() {
  const { ok, countries } = validate()
  if (!ok) return
  saving.value = true
  const { error } = await supabase.from('store_settings').update({
    store_name: form.store_name.trim(),
    legal_name: form.legal_name.trim() || null,
    vat_number: form.vat_number.trim() || null,
    contact_email: form.contact_email.trim() || null,
    default_locale: form.default_locale,
    currency: form.currency,
    vat_rate: round2(form.vat_rate),
    prices_include_vat: form.prices_include_vat,
    shipping_fee: round2(form.shipping_fee),
    free_shipping_threshold: form.free_shipping_threshold === '' ? null : round2(Number(form.free_shipping_threshold)),
    shipping_countries: countries,
    payment_methods: form.payment_methods,
    stripe_publishable_key: form.stripe_publishable_key.trim() || null,
    low_stock_threshold: Math.max(0, Math.trunc(form.low_stock_threshold)),
    max_quantity_per_item: Math.min(999, Math.max(1, Math.trunc(form.max_quantity_per_item))),
  }).eq('id', 1)
  saving.value = false
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  toast.success(t('adm.common.saved'))
  await refresh()
  clearNuxtData('store-settings') // nombre de la tienda en cabecera/pie
}

// ---------------------------------------------------------------------------
// Llaves secretas de Stripe (solo escritura)
// ---------------------------------------------------------------------------
const secrets = reactive({ secret: '', webhook: '' })
const savingKeys = ref(false)
const keyErrors = ref<{ secret?: string, webhook?: string }>({})

async function saveKeys() {
  keyErrors.value = {}
  const sk = secrets.secret.trim()
  const wh = secrets.webhook.trim()
  if (sk && !SK_PATTERN.test(sk)) keyErrors.value.secret = t('adm.settings.errors.invalid_format')
  if (wh && !WH_PATTERN.test(wh)) keyErrors.value.webhook = t('adm.settings.errors.invalid_format')
  if (keyErrors.value.secret || keyErrors.value.webhook || (!sk && !wh)) return

  savingKeys.value = true
  const { error } = await supabase.rpc('admin_set_stripe_secrets', {
    p_stripe_secret_key: sk || undefined,
    p_stripe_webhook_secret: wh || undefined,
  })
  savingKeys.value = false
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  secrets.secret = ''
  secrets.webhook = ''
  toast.success(t('adm.settings.keys_saved'))
  await refreshSecrets()
}

// ---------------------------------------------------------------------------
// Prueba de conexión
// ---------------------------------------------------------------------------
type TestResult = Awaited<ReturnType<typeof runTestRequest>>
function runTestRequest() {
  return $fetch('/api/admin/settings/stripe-test', { method: 'POST' })
}
const testing = ref(false)
const testResult = ref<TestResult | null>(null)

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await runTestRequest()
  }
  catch {
    toast.error(t('adm.settings.errors.stripe_error'))
  }
  finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <AdminPageHeader :title="t('adm.settings.title')" :description="t('adm.settings.intro')" />

    <form class="space-y-8" novalidate @submit.prevent="save">
      <!-- Tienda -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.store_section') }}</h2>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="s-name" class="form-label">{{ t('adm.settings.store_name') }} *</label>
            <input id="s-name" v-model="form.store_name" type="text" maxlength="120" class="form-input" :aria-invalid="!!errors.store_name">
            <p v-if="errors.store_name" class="form-error">{{ errors.store_name }}</p>
          </div>
          <div>
            <label for="s-legal" class="form-label">{{ t('adm.settings.legal_name') }}</label>
            <input id="s-legal" v-model="form.legal_name" type="text" maxlength="200" class="form-input">
          </div>
          <div>
            <label for="s-vatno" class="form-label">{{ t('adm.settings.vat_number') }}</label>
            <input id="s-vatno" v-model="form.vat_number" type="text" maxlength="40" class="form-input" :placeholder="t('adm.settings.vat_number_hint')">
          </div>
          <div>
            <label for="s-email" class="form-label">{{ t('adm.settings.contact_email') }}</label>
            <input id="s-email" v-model="form.contact_email" type="email" class="form-input">
          </div>
          <div>
            <label for="s-locale" class="form-label">{{ t('adm.settings.default_locale') }}</label>
            <select id="s-locale" v-model="form.default_locale" class="form-input">
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Precios e IVA -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.pricing_section') }}</h2>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="s-currency" class="form-label">{{ t('adm.settings.currency') }}</label>
            <select id="s-currency" v-model="form.currency" class="form-input">
              <option value="CHF">CHF</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label for="s-vat" class="form-label">{{ t('adm.settings.vat_rate') }}</label>
            <input id="s-vat" v-model.number="form.vat_rate" type="number" min="0" max="99.99" step="0.01" class="form-input">
            <p class="mt-1 text-xs text-gray-500">{{ t('adm.settings.vat_rate_hint') }}</p>
          </div>
        </div>
        <label class="flex items-start gap-3">
          <input v-model="form.prices_include_vat" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600">
          <span>
            <span class="block text-sm font-medium text-gray-800">{{ t('adm.settings.prices_include_vat') }}</span>
            <span class="block text-xs text-gray-500">{{ t('adm.settings.prices_include_vat_hint') }}</span>
          </span>
        </label>
      </section>

      <!-- Envío -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.shipping_section') }}</h2>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="s-ship" class="form-label">{{ t('adm.settings.shipping_fee') }} ({{ form.currency }})</label>
            <input id="s-ship" v-model.number="form.shipping_fee" type="number" min="0" step="0.05" class="form-input">
            <p v-if="errors.shipping_fee" class="form-error">{{ errors.shipping_fee }}</p>
          </div>
          <div>
            <label for="s-free" class="form-label">{{ t('adm.settings.free_shipping_threshold') }} ({{ form.currency }})</label>
            <input id="s-free" v-model="form.free_shipping_threshold" type="number" min="0" step="0.05" class="form-input">
            <p class="mt-1 text-xs text-gray-500">{{ t('adm.settings.free_shipping_hint') }}</p>
          </div>
          <div class="sm:col-span-2">
            <label for="s-countries" class="form-label">{{ t('adm.settings.shipping_countries') }}</label>
            <input id="s-countries" v-model="form.shipping_countries" type="text" class="form-input" :aria-invalid="!!errors.shipping_countries">
            <p class="mt-1 text-xs" :class="errors.shipping_countries ? 'text-red-600' : 'text-gray-500'">{{ t('adm.settings.shipping_countries_hint') }}</p>
          </div>
        </div>
      </section>

      <!-- Stock -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.stock_section') }}</h2>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="s-low" class="form-label">{{ t('adm.settings.low_stock_threshold') }}</label>
            <input id="s-low" v-model.number="form.low_stock_threshold" type="number" min="0" step="1" class="form-input">
          </div>
          <div>
            <label for="s-max" class="form-label">{{ t('adm.settings.max_quantity_per_item') }}</label>
            <input id="s-max" v-model.number="form.max_quantity_per_item" type="number" min="1" max="999" step="1" class="form-input">
          </div>
        </div>
      </section>

      <!-- Medios de pago -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.payments_section') }}</h2>
        <fieldset class="grid gap-3 sm:grid-cols-2">
          <legend class="sr-only">{{ t('adm.settings.payments_section') }}</legend>
          <label v-for="m in PAYMENT_METHODS" :key="m" class="flex items-start gap-3 rounded-lg border border-gray-200 p-3" :class="m === 'twint' && form.currency !== 'CHF' ? 'opacity-50' : ''">
            <input
              v-model="form.payment_methods"
              type="checkbox"
              :value="m"
              :disabled="m === 'twint' && form.currency !== 'CHF'"
              class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
            >
            <span>
              <span class="block text-sm font-medium text-gray-800">{{ t(`adm.settings.pm_${m}`) }}</span>
              <span v-if="m === 'twint'" class="block text-xs text-gray-500">{{ t('adm.settings.pm_twint_hint') }}</span>
            </span>
          </label>
        </fieldset>
        <p v-if="errors.payment_methods" class="form-error">{{ errors.payment_methods }}</p>

        <div>
          <label for="s-pk" class="form-label">{{ t('adm.settings.publishable_key') }}</label>
          <input id="s-pk" v-model="form.stripe_publishable_key" type="text" autocomplete="off" spellcheck="false" class="form-input font-mono" placeholder="pk_live_…">
          <p class="mt-1 text-xs" :class="errors.stripe_publishable_key ? 'text-red-600' : 'text-gray-500'">
            {{ errors.stripe_publishable_key || t('adm.settings.publishable_key_hint') }}
          </p>
        </div>
      </section>

      <div class="flex justify-end">
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? t('adm.common.saving') : t('adm.common.save') }}</button>
      </div>
    </form>

    <!-- Stripe: llaves secretas (formulario independiente, solo escritura) -->
    <section class="card mt-8 space-y-5">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.stripe_section') }}</h2>
        <p class="mt-1 text-sm text-gray-600">{{ t('adm.settings.stripe_intro') }}</p>
      </div>

      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div class="rounded-lg bg-gray-50 p-3">
          <dt class="text-gray-500">{{ t('adm.settings.secret_key') }}</dt>
          <dd class="mt-1 font-medium" :class="secretStatus?.secret_key_configured ? 'text-green-700' : 'text-amber-700'">
            <template v-if="secretStatus?.secret_key_configured">
              {{ t('adm.settings.configured') }} · {{ t('adm.settings.mode', { mode: secretStatus.secret_key_mode }) }} · …{{ secretStatus.secret_key_last4 }}
            </template>
            <template v-else>{{ t('adm.settings.not_configured') }}</template>
          </dd>
        </div>
        <div class="rounded-lg bg-gray-50 p-3">
          <dt class="text-gray-500">{{ t('adm.settings.webhook_secret') }}</dt>
          <dd class="mt-1 font-medium" :class="secretStatus?.webhook_secret_configured ? 'text-green-700' : 'text-amber-700'">
            {{ secretStatus?.webhook_secret_configured ? t('adm.settings.configured') : t('adm.settings.not_configured') }}
          </dd>
        </div>
      </dl>

      <form class="grid gap-5 sm:grid-cols-2" novalidate @submit.prevent="saveKeys">
        <div>
          <label for="s-sk" class="form-label">{{ t('adm.settings.secret_key') }}</label>
          <input id="s-sk" v-model="secrets.secret" type="password" autocomplete="new-password" spellcheck="false" class="form-input font-mono" placeholder="sk_live_…">
          <p class="mt-1 text-xs" :class="keyErrors.secret ? 'text-red-600' : 'text-gray-500'">{{ keyErrors.secret || t('adm.settings.secret_key_hint') }}</p>
        </div>
        <div>
          <label for="s-wh" class="form-label">{{ t('adm.settings.webhook_secret') }}</label>
          <input id="s-wh" v-model="secrets.webhook" type="password" autocomplete="new-password" spellcheck="false" class="form-input font-mono" placeholder="whsec_…">
          <p class="mt-1 text-xs" :class="keyErrors.webhook ? 'text-red-600' : 'text-gray-500'">{{ keyErrors.webhook || t('adm.settings.webhook_secret_hint') }}</p>
        </div>
        <div class="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" class="btn-primary" :disabled="savingKeys || (!secrets.secret && !secrets.webhook)">
            {{ savingKeys ? t('adm.common.saving') : t('adm.settings.save_keys') }}
          </button>
          <button type="button" class="btn-secondary" :disabled="testing || !secretStatus?.secret_key_configured" @click="testConnection">
            {{ testing ? t('adm.settings.testing') : t('adm.settings.test_connection') }}
          </button>
        </div>
      </form>

      <!-- Resultado de la prueba -->
      <div v-if="testResult" role="status" class="rounded-lg border p-4 text-sm" :class="testResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'">
        <template v-if="testResult.ok && 'account' in testResult">
          <p class="font-semibold text-green-900">{{ t('adm.settings.test_ok') }}</p>
          <ul class="mt-2 space-y-1 text-green-900">
            <li>{{ t('adm.settings.account') }}: {{ testResult.account.name || testResult.account.id }} ({{ testResult.account.id }})</li>
            <li>{{ t('adm.settings.account_country') }}: {{ testResult.account.country }} · {{ testResult.account.defaultCurrency }} · {{ t('adm.settings.mode', { mode: testResult.mode }) }}</li>
            <li>{{ t('adm.settings.charges') }}: {{ testResult.account.chargesEnabled ? t('adm.settings.enabled') : t('adm.settings.disabled') }} · {{ t('adm.settings.payouts') }}: {{ testResult.account.payoutsEnabled ? t('adm.settings.enabled') : t('adm.settings.disabled') }}</li>
          </ul>
          <ul v-if="testResult.warnings.length" class="mt-3 list-disc space-y-1 pl-5 text-amber-800">
            <li v-for="w in testResult.warnings" :key="w">{{ t(`adm.settings.warnings.${w}`) }}</li>
          </ul>
        </template>
        <p v-else-if="'error' in testResult" class="font-medium text-red-800">{{ t(`adm.settings.errors.${testResult.error}`) }}</p>
      </div>
    </section>

    <!-- Webhook -->
    <section v-if="integrations" class="card mt-8 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.webhook_title') }}</h2>
      <p class="text-sm text-gray-600">{{ t('adm.settings.webhook_help') }}</p>
      <div>
        <span class="form-label">{{ t('adm.settings.webhook_url') }}</span>
        <div class="flex gap-2">
          <code class="flex-1 overflow-x-auto rounded-lg bg-gray-100 px-3 py-2 text-sm">{{ integrations.webhookUrl }}</code>
          <AdminCopyButton :value="integrations.webhookUrl" />
        </div>
      </div>
      <div>
        <span class="form-label">{{ t('adm.settings.webhook_events') }}</span>
        <ul class="flex flex-wrap gap-2">
          <li v-for="ev in integrations.webhookEvents" :key="ev"><code class="rounded bg-gray-100 px-2 py-1 text-xs">{{ ev }}</code></li>
        </ul>
      </div>
    </section>

    <!-- Email -->
    <section v-if="integrations" class="card mt-8">
      <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.settings.email_section') }}</h2>
      <p class="mt-2 text-sm" :class="integrations.email.configured ? 'text-green-700' : 'text-amber-700'">
        {{ integrations.email.configured ? t('adm.settings.email_configured', { from: integrations.email.from }) : t('adm.settings.email_not_configured') }}
      </p>
    </section>
  </div>
</template>

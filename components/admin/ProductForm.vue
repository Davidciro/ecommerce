<script setup lang="ts">
import type { Database } from '~/types/database.types'
import {
  LOCALES, emptyLocalized, emptyLocalizedArray, toLocalized, toLocalizedArray, missingLocales, pickLocalized,
  type Locale, type Localized,
} from '~/utils/localized'

/**
 * Crear / editar producto. El coste de producción se guarda en `product_costs`
 * (tabla protegida por RLS, solo admin) y nunca en `products`.
 */
const props = defineProps<{ productId?: string }>()

const { t, locale: uiLocale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()
const toast = useToast()

const isNew = computed(() => !props.productId)
const editLocale = ref<Locale>((LOCALES as readonly string[]).includes(uiLocale.value) ? (uiLocale.value as Locale) : 'fr')

// Configuración para mostrar IVA y margen
const { data: store } = await useAsyncData('adm:product-store', async () => {
  const { data } = await supabase.from('store_settings').select('currency, vat_rate, prices_include_vat').eq('id', 1).single()
  return data
})

// ---------------------------------------------------------------------------
// Estado del formulario
// ---------------------------------------------------------------------------
const form = reactive({
  name: emptyLocalized(),
  slug: emptyLocalized(),
  short_description: emptyLocalized(),
  long_description: emptyLocalized(),
  seo_title: emptyLocalized(),
  seo_description: emptyLocalized(),
  seo_keywords: emptyLocalizedArray(),
  sku: '',
  sale_price: 0,
  production_price: '' as number | '',
  stock: 0,
  is_active: false,
  is_featured: false,
  sort_order: 0,
})
const productName = ref('')

if (props.productId) {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_costs(production_price)')
    .eq('id', props.productId)
    .maybeSingle()
  if (error || !data) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

  const cost = Array.isArray(data.product_costs) ? data.product_costs[0] : data.product_costs
  Object.assign(form, {
    name: toLocalized(data.name),
    slug: toLocalized(data.slug),
    short_description: toLocalized(data.short_description),
    long_description: toLocalized(data.long_description),
    seo_title: toLocalized(data.seo_title),
    seo_description: toLocalized(data.seo_description),
    seo_keywords: toLocalizedArray(data.seo_keywords),
    sku: data.sku ?? '',
    sale_price: Number(data.sale_price),
    production_price: cost?.production_price === undefined || cost?.production_price === null ? '' : Number(cost.production_price),
    stock: data.stock,
    is_active: data.is_active,
    is_featured: data.is_featured,
    sort_order: data.sort_order,
  })
  productName.value = pickLocalized(data.name, uiLocale.value)
}

// ---------------------------------------------------------------------------
// Derivados
// ---------------------------------------------------------------------------
const incomplete = computed(() => {
  const out: Partial<Record<Locale, boolean>> = {}
  for (const l of LOCALES) {
    out[l] = [form.name, form.slug, form.short_description, form.long_description].some(f => !f[l].trim())
  }
  return out
})

const margin = computed(() => {
  if (form.production_price === '' || !store.value) return null
  const vat = Number(store.value.vat_rate)
  const net = store.value.prices_include_vat ? form.sale_price / (1 + vat / 100) : form.sale_price
  const value = net - Number(form.production_price)
  const percent = net > 0 ? (value / net) * 100 : 0
  return { value, percent, positive: value >= 0 }
})

function generateSlug(l: Locale) {
  form.slug = { ...form.slug, [l]: slugify(form.name[l]) }
}

// ---------------------------------------------------------------------------
// Guardado
// ---------------------------------------------------------------------------
const saving = ref(false)
const errorKey = ref<string | null>(null)

function validate(): string | null {
  for (const l of LOCALES) {
    if (!form.slug[l].trim() && form.name[l].trim()) form.slug[l] = slugify(form.name[l])
    if (form.slug[l] && !SLUG_PATTERN.test(form.slug[l])) return 'adm.products.errors.invalid_slug'
  }
  if (!(form.sale_price >= 0)) return 'adm.products.errors.invalid_price'
  if (form.production_price !== '' && !(Number(form.production_price) >= 0)) return 'adm.products.errors.invalid_price'
  if (!Number.isInteger(form.stock) || form.stock < 0) return 'adm.products.errors.invalid_stock'
  if (form.is_active && (missingLocales(form.name).length || missingLocales(form.slug).length)) {
    return 'adm.products.errors.incomplete_for_active'
  }
  return null
}

function mapDbError(err: { code?: string, message?: string }): string {
  if (err.code === '23505') return err.message?.includes('sku') ? 'adm.common.error' : 'adm.products.errors.slug_taken'
  if (err.code === '23514') return 'adm.products.errors.incomplete_for_active'
  return 'adm.common.error'
}

async function save() {
  errorKey.value = validate()
  if (errorKey.value) return
  saving.value = true

  const payload = {
    name: form.name,
    slug: form.slug,
    short_description: form.short_description,
    long_description: form.long_description,
    seo_title: form.seo_title,
    seo_description: form.seo_description,
    seo_keywords: form.seo_keywords,
    sku: form.sku.trim() || null,
    sale_price: round2(form.sale_price),
    stock: form.stock,
    is_active: form.is_active,
    is_featured: form.is_featured,
    sort_order: Math.trunc(form.sort_order),
  }

  try {
    let id = props.productId
    if (!id) {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single()
      if (error) throw error
      id = data.id
    }
    else {
      const { error } = await supabase.from('products').update(payload).eq('id', id)
      if (error) throw error
    }

    // Coste de producción (tabla protegida)
    if (form.production_price === '') {
      await supabase.from('product_costs').delete().eq('product_id', id)
    }
    else {
      const { error } = await supabase.from('product_costs').upsert({
        product_id: id,
        production_price: round2(Number(form.production_price)),
      })
      if (error) throw error
    }

    productName.value = pickLocalized(form.name, uiLocale.value)
    if (isNew.value) {
      toast.success(t('adm.products.created'))
      await navigateTo(localePath(`/admin/products/${id}`), { replace: true })
    }
    else {
      toast.success(t('adm.common.saved'))
    }
  }
  catch (err) {
    errorKey.value = mapDbError(err as { code?: string, message?: string })
  }
  finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// Eliminación
// ---------------------------------------------------------------------------
const deleting = ref(false)
async function remove() {
  if (!props.productId) return
  if (!confirm(t('adm.products.confirm_delete', { name: productName.value }))) return
  deleting.value = true
  const { data: imgs } = await supabase.from('product_images').select('storage_path').eq('product_id', props.productId)
  const { error } = await supabase.from('products').delete().eq('id', props.productId)
  if (error) {
    deleting.value = false
    toast.error(t('adm.common.error'))
    return
  }
  const paths = (imgs ?? []).map(i => i.storage_path)
  if (paths.length) await supabase.storage.from('product-images').remove(paths)
  toast.success(t('adm.products.deleted'))
  await navigateTo(localePath('/admin/products'))
}

const priceHint = computed(() =>
  store.value?.prices_include_vat ? t('adm.products.sale_price_hint_incl') : t('adm.products.sale_price_hint_excl'),
)
const currency = computed(() => store.value?.currency ?? 'CHF')
const keywords = computed<string[]>({
  get: () => form.seo_keywords[editLocale.value],
  set: v => { form.seo_keywords = { ...form.seo_keywords, [editLocale.value]: v } as Localized<string[]> },
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <AdminPageHeader
      :title="isNew ? t('adm.products.new') : productName || t('adm.products.edit')"
      :back-to="localePath('/admin/products')"
    >
      <template #actions>
        <AdminLocaleTabs v-model="editLocale" :incomplete="incomplete" />
      </template>
    </AdminPageHeader>

    <form class="space-y-8" novalidate @submit.prevent="save">
      <div v-if="errorKey" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ t(errorKey) }}
      </div>

      <!-- Contenido -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.products.sec_content') }}</h2>
        <AdminLocalizedField id="p-name" v-model="form.name" :label="t('adm.products.name')" :locale="editLocale" :maxlength="200" required />
        <div>
          <AdminLocalizedField id="p-slug" v-model="form.slug" :label="t('adm.products.slug')" :locale="editLocale" :maxlength="80" :hint="t('adm.products.slug_hint')" />
          <button type="button" class="mt-1 text-xs font-medium text-brand-700 hover:underline" @click="generateSlug(editLocale)">
            {{ t('adm.products.generate_slug') }}
          </button>
        </div>
        <AdminLocalizedField id="p-short" v-model="form.short_description" :label="t('adm.products.short_description')" :locale="editLocale" multiline :rows="2" :maxlength="300" />
        <AdminLocalizedField id="p-long" v-model="form.long_description" :label="t('adm.products.long_description')" :locale="editLocale" multiline :rows="8" :maxlength="10000" />
      </section>

      <!-- Precio y stock -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.products.sec_pricing') }}</h2>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label for="p-price" class="form-label">{{ t('adm.products.sale_price') }} ({{ currency }})</label>
            <input id="p-price" v-model.number="form.sale_price" type="number" min="0" step="0.05" required class="form-input">
            <p class="mt-1 text-xs text-gray-500">{{ priceHint }}</p>
          </div>
          <div>
            <label for="p-cost" class="form-label">{{ t('adm.products.production_price') }} ({{ currency }})</label>
            <input id="p-cost" v-model="form.production_price" type="number" min="0" step="0.05" class="form-input">
            <p class="mt-1 text-xs text-gray-500">{{ t('adm.products.production_price_hint') }}</p>
          </div>
          <div>
            <label for="p-stock" class="form-label">{{ t('adm.products.stock') }}</label>
            <input id="p-stock" v-model.number="form.stock" type="number" min="0" step="1" required class="form-input">
          </div>
          <div>
            <label for="p-sku" class="form-label">{{ t('adm.products.sku') }}</label>
            <input id="p-sku" v-model="form.sku" type="text" maxlength="64" class="form-input">
          </div>
        </div>
        <p v-if="margin" class="text-sm font-medium" :class="margin.positive ? 'text-green-700' : 'text-red-700'">
          {{ t('adm.products.margin', { value: formatMoney(margin.value, currency, uiLocale), percent: formatNumber(margin.percent, uiLocale, 1) }) }}
        </p>
      </section>

      <!-- Imágenes -->
      <section class="card">
        <h2 class="mb-4 text-lg font-semibold text-gray-900">{{ t('adm.products.sec_images') }}</h2>
        <AdminProductImages v-if="productId" :product-id="productId" :locale="editLocale" />
        <p v-else class="text-sm text-gray-500">{{ t('adm.products.images_after_save') }}</p>
      </section>

      <!-- SEO -->
      <section class="card space-y-5">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.products.sec_seo') }}</h2>
        <AdminLocalizedField id="p-seo-title" v-model="form.seo_title" :label="t('adm.products.seo_title')" :locale="editLocale" :maxlength="120" :recommended="60" />
        <AdminLocalizedField id="p-seo-desc" v-model="form.seo_description" :label="t('adm.products.seo_description')" :locale="editLocale" multiline :rows="3" :maxlength="320" :recommended="160" />
        <AdminKeywordsInput :id="`p-seo-kw-${editLocale}`" v-model="keywords" :label="`${t('adm.products.seo_keywords')} (${editLocale.toUpperCase()})`" :hint="t('adm.seo.keywords_hint')" />
      </section>

      <!-- Visibilidad -->
      <section class="card space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">{{ t('adm.products.sec_visibility') }}</h2>
        <label class="flex items-start gap-3">
          <input v-model="form.is_active" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600">
          <span>
            <span class="block text-sm font-medium text-gray-800">{{ t('adm.products.is_active') }}</span>
            <span class="block text-xs text-gray-500">{{ t('adm.products.is_active_hint') }}</span>
          </span>
        </label>
        <label class="flex items-center gap-3">
          <input v-model="form.is_featured" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
          <span class="text-sm font-medium text-gray-800">{{ t('adm.products.is_featured') }}</span>
        </label>
        <div class="max-w-40">
          <label for="p-order" class="form-label">{{ t('adm.products.sort_order') }}</label>
          <input id="p-order" v-model.number="form.sort_order" type="number" step="1" class="form-input">
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <button v-if="!isNew" type="button" class="btn-ghost text-red-600" :disabled="deleting" @click="remove">
          {{ deleting ? t('adm.common.deleting') : t('adm.products.delete_product') }}
        </button>
        <span v-else />
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? t('adm.common.saving') : t('adm.common.save') }}</button>
      </div>
    </form>
  </div>
</template>

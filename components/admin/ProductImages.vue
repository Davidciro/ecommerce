<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { toLocalized, type Locale, type Localized } from '~/utils/localized'

/**
 * Imágenes de un producto (máx. 3) en el bucket `product-images`.
 * Ruta: products/<product_id>/<uuid>.webp — validada también por CHECK en BD.
 */
const props = defineProps<{ productId: string, locale: Locale }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const publicUrl = useStorageUrl()
const toast = useToast()

interface ImageRow { id: string, storage_path: string, position: number, alt: Localized }
const images = ref<ImageRow[]>([])
const uploading = ref(false)
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const MAX = 3

async function load() {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, storage_path, position, alt')
    .eq('product_id', props.productId)
    .order('position')
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  images.value = (data ?? []).map(r => ({ ...r, alt: toLocalized(r.alt) }))
}
await load()

function errorMessage(code: string) {
  if (code === 'unsupported_type') return t('adm.products.errors.image_type')
  if (code === 'file_too_large') return t('adm.products.errors.image_size')
  return t('adm.products.errors.upload_failed')
}

async function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (fileInput.value) fileInput.value.value = ''
  if (!files.length) return
  if (images.value.length + files.length > MAX) {
    toast.error(t('adm.products.errors.max_images'))
    files.splice(MAX - images.value.length)
  }

  uploading.value = true
  for (const file of files) {
    const used = new Set(images.value.map(i => i.position))
    const position = [0, 1, 2].find(p => !used.has(p))
    if (position === undefined) break
    let path: string | null = null
    try {
      const img = await optimizeImage(file)
      path = `products/${props.productId}/${crypto.randomUUID()}.${extensionFor(img.type)}`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, img.blob, {
        contentType: img.type,
        cacheControl: '31536000',
        upsert: false,
      })
      if (upErr) throw new Error('upload_failed')

      const { data, error } = await supabase
        .from('product_images')
        .insert({
          product_id: props.productId,
          storage_path: path,
          position,
          width: img.width,
          height: img.height,
          size_bytes: img.blob.size,
        })
        .select('id, storage_path, position, alt')
        .single()
      if (error) throw new Error('upload_failed')
      images.value = [...images.value, { ...data, alt: toLocalized(data.alt) }].sort((a, b) => a.position - b.position)
    }
    catch (err) {
      if (path) await supabase.storage.from('product-images').remove([path])
      toast.error(errorMessage((err as Error).message))
    }
  }
  uploading.value = false
}

async function move(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= images.value.length) return
  const ordered = [...images.value]
  ;[ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]
  busy.value = true
  const { error } = await supabase.rpc('admin_reorder_product_images', {
    p_product_id: props.productId,
    p_image_ids: ordered.map(i => i.id),
  })
  busy.value = false
  if (error) {
    toast.error(t('adm.common.error'))
    return
  }
  images.value = ordered.map((img, i) => ({ ...img, position: i }))
}

async function remove(img: ImageRow) {
  if (!confirm(t('adm.products.confirm_remove_image'))) return
  busy.value = true
  const { error } = await supabase.from('product_images').delete().eq('id', img.id)
  if (!error) {
    await supabase.storage.from('product-images').remove([img.storage_path])
    const rest = images.value.filter(i => i.id !== img.id)
    // Compacta posiciones para que la primera siga siendo la principal
    if (rest.length) {
      await supabase.rpc('admin_reorder_product_images', { p_product_id: props.productId, p_image_ids: rest.map(i => i.id) })
    }
    images.value = rest.map((r, i) => ({ ...r, position: i }))
  }
  else {
    toast.error(t('adm.common.error'))
  }
  busy.value = false
}

async function saveAlt(img: ImageRow) {
  const { error } = await supabase.from('product_images').update({ alt: img.alt }).eq('id', img.id)
  if (error) toast.error(t('adm.common.error'))
}
</script>

<template>
  <div>
    <p class="mb-4 text-sm text-gray-600">{{ t('adm.products.images_hint') }}</p>
    <ul class="grid gap-4 sm:grid-cols-3">
      <li v-for="(img, i) in images" :key="img.id" class="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div class="relative aspect-square bg-gray-50">
          <img :src="publicUrl('product-images', img.storage_path) ?? ''" :alt="img.alt[locale]" class="h-full w-full object-cover" loading="lazy">
          <span v-if="i === 0" class="absolute left-2 top-2 rounded-md bg-gray-900/80 px-2 py-0.5 text-xs font-medium text-white">
            {{ t('adm.products.main_image') }}
          </span>
        </div>
        <div class="space-y-2 p-3">
          <label :for="`alt-${img.id}`" class="text-xs font-medium text-gray-600">
            {{ t('adm.products.image_alt') }} <span class="uppercase text-gray-400">({{ locale }})</span>
          </label>
          <input :id="`alt-${img.id}`" v-model="img.alt[locale]" type="text" maxlength="200" class="form-input" @change="saveAlt(img)">
          <div class="flex items-center justify-between gap-1">
            <div class="flex gap-1">
              <button type="button" class="btn-ghost px-2 py-1" :disabled="busy || i === 0" :aria-label="t('adm.products.move_left')" @click="move(i, -1)">←</button>
              <button type="button" class="btn-ghost px-2 py-1" :disabled="busy || i === images.length - 1" :aria-label="t('adm.products.move_right')" @click="move(i, 1)">→</button>
            </div>
            <button type="button" class="btn-ghost px-2 py-1 text-red-600" :disabled="busy" @click="remove(img)">{{ t('adm.products.remove_image') }}</button>
          </div>
        </div>
      </li>

      <li v-if="images.length < MAX">
        <label
          for="product-image-input"
          class="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-700"
          :class="{ 'pointer-events-none opacity-60': uploading }"
        >
          <span class="text-3xl" aria-hidden="true">+</span>
          {{ uploading ? t('adm.products.uploading') : t('adm.products.add_image') }}
        </label>
        <input
          id="product-image-input"
          ref="fileInput"
          type="file"
          :accept="ACCEPTED_IMAGE_TYPES.join(',')"
          multiple
          class="sr-only"
          :disabled="uploading"
          @change="onFiles"
        >
      </li>
    </ul>
  </div>
</template>

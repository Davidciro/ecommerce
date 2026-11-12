<script setup lang="ts">
/**
 * Imagen única en el bucket `site-assets` (CMS, Open Graph). v-model = ruta en el bucket.
 * Optimiza en el navegador (WebP) antes de subir.
 */
const model = defineModel<string | null>({ required: true })
const props = withDefaults(defineProps<{ id: string, label: string, folder: string, maxSize?: number }>(), { maxSize: 1920 })

const { t } = useI18n()
const supabase = useSupabaseClient()
const publicUrl = useStorageUrl()
const toast = useToast()
const busy = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  try {
    const img = await optimizeImage(file, { maxSize: props.maxSize, maxBytes: 5 * 1024 * 1024 })
    const path = `${props.folder}/${crypto.randomUUID()}.${extensionFor(img.type)}`
    const { error } = await supabase.storage.from('site-assets').upload(path, img.blob, {
      contentType: img.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    const previous = model.value
    model.value = path
    // El archivo anterior queda huérfano: se elimina para no acumular basura.
    if (previous) await supabase.storage.from('site-assets').remove([previous])
  }
  catch (err) {
    const code = (err as Error).message
    toast.error(code === 'unsupported_type' ? t('adm.products.errors.image_type') : code === 'file_too_large' ? t('adm.products.errors.image_size') : t('adm.products.errors.upload_failed'))
  }
  finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

async function clear() {
  const previous = model.value
  model.value = null
  if (previous) await supabase.storage.from('site-assets').remove([previous])
}
</script>

<template>
  <div>
    <span class="form-label">{{ label }}</span>
    <div class="flex items-center gap-4">
      <div class="flex h-24 w-36 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        <img v-if="model" :src="publicUrl('site-assets', model) ?? ''" alt="" class="h-full w-full object-cover">
        <span v-else class="text-xs text-gray-400">—</span>
      </div>
      <div class="flex flex-col gap-2">
        <label :for="id" class="btn-secondary cursor-pointer" :class="{ 'pointer-events-none opacity-60': busy }">
          {{ busy ? t('adm.products.uploading') : t('adm.cms.upload_image') }}
        </label>
        <input :id="id" ref="input" type="file" :accept="ACCEPTED_IMAGE_TYPES.join(',')" class="sr-only" :disabled="busy" @change="onFile">
        <button v-if="model" type="button" class="btn-ghost text-red-600" :disabled="busy" @click="clear">{{ t('adm.cms.remove_image') }}</button>
      </div>
    </div>
  </div>
</template>

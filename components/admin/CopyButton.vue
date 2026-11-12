<script setup lang="ts">
const props = defineProps<{ value: string }>()
const { t } = useI18n()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  }
  catch {
    // portapapeles no disponible (http sin TLS): sin acción
  }
}
</script>

<template>
  <button type="button" class="btn-secondary shrink-0 px-3 py-2" @click="copy">
    {{ copied ? t('adm.common.copied') : t('adm.common.copy') }}
  </button>
</template>

<script setup lang="ts">
import { LOCALES, type Locale } from '~/utils/localized'

/** Pestañas de idioma de edición para un formulario. `incomplete` marca idiomas con campos vacíos. */
const model = defineModel<Locale>({ required: true })
defineProps<{ incomplete?: Partial<Record<Locale, boolean>> }>()
const { t } = useI18n()
</script>

<template>
  <div role="tablist" :aria-label="t('adm.common.edit_language')" class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
    <button
      v-for="l in LOCALES"
      :key="l"
      type="button"
      role="tab"
      :aria-selected="model === l"
      class="relative rounded-md px-3 py-1.5 text-sm font-semibold uppercase transition-colors"
      :class="model === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'"
      @click="model = l"
    >
      {{ l }}
      <span
        v-if="incomplete?.[l]"
        class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500"
        :title="t('adm.common.missing_translation', { locales: l.toUpperCase() })"
      />
    </button>
  </div>
</template>

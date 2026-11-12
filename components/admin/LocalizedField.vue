<script setup lang="ts">
import type { Locale, Localized } from '~/utils/localized'

/**
 * Campo de texto multilenguaje: edita el idioma activo de un objeto {fr, de, es}.
 * `recommended` muestra contador (p. ej. 60 para meta title, 160 para description).
 */
const model = defineModel<Localized>({ required: true })
const props = withDefaults(defineProps<{
  id: string
  label: string
  locale: Locale
  multiline?: boolean
  rows?: number
  maxlength?: number
  recommended?: number
  hint?: string
  required?: boolean
}>(), { multiline: false, rows: 4 })

const { t } = useI18n()

const value = computed({
  get: () => model.value[props.locale] ?? '',
  set: (v: string) => { model.value = { ...model.value, [props.locale]: v } },
})
const missing = computed(() => (['fr', 'de', 'es'] as const).filter(l => !model.value[l]?.trim()))
const fieldId = computed(() => `${props.id}-${props.locale}`)
</script>

<template>
  <div>
    <div class="mb-1 flex items-baseline justify-between gap-2">
      <label :for="fieldId" class="form-label mb-0">
        {{ label }} <span class="text-xs font-normal uppercase text-gray-400">({{ locale }})</span>
        <span v-if="required" class="text-red-600" aria-hidden="true">*</span>
      </label>
      <span v-if="recommended" class="text-xs" :class="value.length > recommended ? 'text-amber-600' : 'text-gray-400'">
        {{ t('adm.seo.chars', { count: value.length, max: recommended }) }}
      </span>
    </div>
    <textarea
      v-if="multiline"
      :id="fieldId"
      v-model="value"
      :rows="rows"
      :maxlength="maxlength"
      :lang="locale"
      class="form-input"
    />
    <input v-else :id="fieldId" v-model="value" type="text" :maxlength="maxlength" :lang="locale" class="form-input">
    <p v-if="hint" class="mt-1 text-xs text-gray-500">{{ hint }}</p>
    <p v-if="missing.length && missing.length < 3" class="mt-1 text-xs text-amber-600">
      {{ t('adm.common.missing_translation', { locales: missing.map(l => l.toUpperCase()).join(', ') }) }}
    </p>
  </div>
</template>

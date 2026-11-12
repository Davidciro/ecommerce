<script setup lang="ts">
/** Entrada de etiquetas (palabras clave): Enter o coma para añadir, Retroceso para quitar la última. */
const model = defineModel<string[]>({ required: true })
defineProps<{ id: string, label: string, hint?: string }>()
const { t } = useI18n()
const draft = ref('')

function add() {
  const parts = draft.value.split(',').map(s => s.trim()).filter(Boolean)
  const next = [...model.value]
  for (const p of parts) if (!next.some(k => k.toLowerCase() === p.toLowerCase()) && p.length <= 80) next.push(p)
  model.value = next.slice(0, 30)
  draft.value = ''
}
function remove(i: number) {
  model.value = model.value.filter((_, idx) => idx !== i)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add()
  }
  else if (e.key === 'Backspace' && !draft.value && model.value.length) {
    remove(model.value.length - 1)
  }
}
</script>

<template>
  <div>
    <label :for="id" class="form-label">{{ label }}</label>
    <div class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600">
      <span v-for="(k, i) in model" :key="k" class="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm text-gray-800">
        {{ k }}
        <button type="button" class="text-gray-400 hover:text-gray-700" :aria-label="`${t('adm.common.delete')} ${k}`" @click="remove(i)">✕</button>
      </span>
      <input :id="id" v-model="draft" type="text" class="min-w-32 flex-1 border-0 p-1 text-sm focus:ring-0" @keydown="onKey" @blur="add">
    </div>
    <p v-if="hint" class="mt-1 text-xs text-gray-500">{{ hint }}</p>
  </div>
</template>

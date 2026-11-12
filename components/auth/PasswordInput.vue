<script setup lang="ts">
const model = defineModel<string>({ required: true })
defineProps<{
  id: string
  label: string
  autocomplete: 'current-password' | 'new-password'
  describedby?: string
  invalid?: boolean
}>()

const { t } = useI18n()
const visible = ref(false)
</script>

<template>
  <div>
    <label :for="id" class="form-label">{{ label }}</label>
    <div class="relative">
      <input
        :id="id"
        v-model="model"
        :type="visible ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :aria-describedby="describedby"
        :aria-invalid="invalid || undefined"
        required
        class="form-input pr-12"
      >
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800"
        :aria-label="visible ? t('common.hide_password') : t('common.show_password')"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          <path v-if="visible" stroke-linecap="round" d="M4 4l16 16" />
        </svg>
      </button>
    </div>
  </div>
</template>

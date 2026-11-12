<script setup lang="ts">
const { toasts, dismiss } = useToast()
const { t } = useI18n()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :role="toast.type === 'error' ? 'alert' : 'status'"
      class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
      :class="{
        'border-green-200 bg-green-50 text-green-900': toast.type === 'success',
        'border-red-200 bg-red-50 text-red-900': toast.type === 'error',
        'border-gray-200 bg-white text-gray-900': toast.type === 'info',
      }"
    >
      <p class="flex-1">{{ toast.message }}</p>
      <button type="button" class="text-current opacity-60 hover:opacity-100" :aria-label="t('adm.common.close')" @click="dismiss(toast.id)">
        ✕
      </button>
    </div>
  </div>
</template>

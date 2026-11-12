<script setup lang="ts">
defineProps<{ title: string, description?: string, backTo?: string }>()
const { t } = useI18n()
</script>

<template>
  <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <NuxtLink v-if="backTo" :to="backTo" class="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        ← {{ t('adm.common.back') }}
      </NuxtLink>
      <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-gray-600">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

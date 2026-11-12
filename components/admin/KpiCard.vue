<script setup lang="ts">
// Import explícito: Nuxt no registra NuxtLink globalmente, así que resolveComponent() no lo encuentra.
import { NuxtLink } from '#components'

defineProps<{ label: string, value: string | number, hint?: string, tone?: 'default' | 'positive' | 'negative' | 'warning', to?: string }>()
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="block rounded-2xl border border-gray-200 bg-white p-5"
    :class="to ? 'transition-colors hover:border-gray-300 hover:bg-gray-50' : ''"
  >
    <p class="text-sm font-medium text-gray-500">{{ label }}</p>
    <p
      class="mt-2 text-2xl font-bold tracking-tight tabular-nums"
      :class="{
        'text-gray-900': !tone || tone === 'default',
        'text-green-700': tone === 'positive',
        'text-red-700': tone === 'negative',
        'text-amber-700': tone === 'warning',
      }"
    >
      {{ value }}
    </p>
    <p v-if="hint" class="mt-1 text-xs text-gray-500">{{ hint }}</p>
  </component>
</template>

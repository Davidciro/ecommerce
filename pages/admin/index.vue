<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const { displayName } = useAuth()

useSeoMeta({ title: () => `${t('admin.dashboard')} · ${t('admin.title')}` })

const sectionKeys = ['products', 'orders', 'customers', 'reports', 'campaigns', 'cms', 'seo', 'messages', 'settings'] as const
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('admin.welcome', { name: displayName }) }}</h1>
    <p class="mt-1 text-gray-600">{{ t('admin.intro') }}</p>

    <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="key in sectionKeys" :key="key" class="rounded-2xl border border-dashed border-gray-300 bg-white p-5">
        <h2 class="font-semibold text-gray-900">{{ t(`admin.sections.${key}`) }}</h2>
        <p class="mt-1 text-sm text-gray-500">{{ t('admin.coming_soon') }}</p>
      </li>
    </ul>
  </div>
</template>

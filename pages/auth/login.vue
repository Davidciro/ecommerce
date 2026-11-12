<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const { t } = useI18n()
useSeoMeta({ title: () => t('auth.login.title') })
</script>

<template>
  <section class="card">
    <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('auth.login.title') }}</h1>
    <p class="mt-1 mb-6 text-sm text-gray-600">{{ t('auth.login.subtitle') }}</p>
    <AuthLoginForm variant="customer" />
  </section>
</template>

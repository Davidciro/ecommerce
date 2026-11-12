<script setup lang="ts">
// Página provisional: la portada definitiva (contenido CMS + destacados) llega en la Fase 4.
const { t } = useI18n()
useSeoMeta({ title: () => t('home.title'), description: () => t('home.intro') })
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-24 text-center">
    <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{{ t('home.title') }}</h1>
    <p class="mt-6 text-lg text-gray-600">{{ t('home.intro') }}</p>
  </section>
</template>

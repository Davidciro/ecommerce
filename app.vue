<script setup lang="ts">
// <html lang>, <link rel="alternate" hreflang="..."> (fr-CH, de-CH, es, x-default),
// canonical y og:locale generados por @nuxtjs/i18n para cada ruta.
const i18nHead = useLocaleHead({ dir: true, lang: true, seo: true })
const { data: store } = await useStoreSettings()

useHead(() => ({
  titleTemplate: (title?: string) => {
    const name = store.value?.store_name || 'Shop'
    return title ? `${title} · ${name}` : name
  },
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs?.lang,
    dir: i18nHead.value.htmlAttrs?.dir,
  },
  link: [...(i18nHead.value.link || [])],
  meta: [...(i18nHead.value.meta || [])],
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

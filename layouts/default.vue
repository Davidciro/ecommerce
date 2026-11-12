<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
    >
      {{ t('site.skip_to_content') }}
    </a>
    <LayoutAppHeader />
    <main id="main" class="flex-1">
      <slot />
    </main>
    <LayoutAppFooter />
  </div>
</template>

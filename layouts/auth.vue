<script setup lang="ts">
const localePath = useLocalePath()
const { data: store } = await useStoreSettings()

// Páginas de autenticación: fuera de buscadores.
useSeoMeta({ robots: 'noindex, nofollow' })
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-50">
    <header class="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
      <NuxtLink :to="localePath('/')" class="text-lg font-bold tracking-tight text-gray-900">
        {{ store?.store_name || 'Shop' }}
      </NuxtLink>
      <LayoutLocaleSwitcher />
    </header>
    <main id="main" class="flex flex-1 items-start justify-center px-4 py-8 sm:py-16">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
  </div>
</template>

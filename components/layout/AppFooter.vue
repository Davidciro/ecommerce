<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { data: store } = await useStoreSettings()
const year = new Date().getFullYear()

const legalLinks = computed(() => [
  { to: localePath('/legal/impressum'), label: t('footer.impressum') },
  { to: localePath('/legal/privacy'), label: t('footer.privacy') },
  { to: localePath('/legal/terms'), label: t('footer.terms') },
  { to: localePath('/legal/cookies'), label: t('footer.cookies') },
])
</script>

<template>
  <footer class="mt-16 border-t border-gray-200 bg-gray-50">
    <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
      <p class="text-sm text-gray-600">
        © {{ year }} {{ store?.store_name || 'Shop' }}. {{ t('footer.rights') }}
      </p>
      <nav :aria-label="t('footer.legal')">
        <ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <li v-for="link in legalLinks" :key="link.to">
            <NuxtLink :to="link.to" class="hover:text-gray-900 hover:underline">{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </footer>
</template>

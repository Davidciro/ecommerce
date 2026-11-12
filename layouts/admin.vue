<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { displayName, signOut } = useAuth()

useSeoMeta({ robots: 'noindex, nofollow' })

// Las secciones se activan a medida que se construyen en la Fase 3.
const sections = computed(() => [
  { key: 'dashboard', to: localePath('/admin'), label: t('admin.dashboard'), ready: true },
  { key: 'products', to: localePath('/admin/products'), label: t('admin.sections.products'), ready: false },
  { key: 'orders', to: localePath('/admin/orders'), label: t('admin.sections.orders'), ready: false },
  { key: 'customers', to: localePath('/admin/customers'), label: t('admin.sections.customers'), ready: false },
  { key: 'reports', to: localePath('/admin/reports'), label: t('admin.sections.reports'), ready: false },
  { key: 'campaigns', to: localePath('/admin/campaigns'), label: t('admin.sections.campaigns'), ready: false },
  { key: 'cms', to: localePath('/admin/cms'), label: t('admin.sections.cms'), ready: false },
  { key: 'seo', to: localePath('/admin/seo'), label: t('admin.sections.seo'), ready: false },
  { key: 'messages', to: localePath('/admin/messages'), label: t('admin.sections.messages'), ready: false },
  { key: 'settings', to: localePath('/admin/settings'), label: t('admin.sections.settings'), ready: false },
])

const menuOpen = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuOpen.value = false })
</script>

<template>
  <div class="min-h-screen bg-gray-50 lg:flex">
    <!-- Barra superior móvil -->
    <div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
      <span class="font-semibold text-gray-900">{{ t('admin.title') }}</span>
      <button
        type="button"
        class="btn-ghost"
        :aria-expanded="menuOpen"
        aria-controls="admin-nav"
        :aria-label="menuOpen ? t('nav.close_menu') : t('nav.open_menu')"
        @click="menuOpen = !menuOpen"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <aside
      id="admin-nav"
      class="border-r border-gray-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col"
      :class="menuOpen ? 'block' : 'hidden lg:flex'"
    >
      <div class="hidden px-6 py-5 lg:block">
        <p class="text-lg font-bold text-gray-900">{{ t('admin.title') }}</p>
        <p class="truncate text-sm text-gray-500">{{ displayName }}</p>
      </div>
      <nav :aria-label="t('admin.title')" class="flex-1 overflow-y-auto px-3 py-2">
        <ul class="space-y-1 text-sm font-medium">
          <li v-for="s in sections" :key="s.key">
            <NuxtLink
              v-if="s.ready"
              :to="s.to"
              class="flex items-center rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
              exact-active-class="bg-brand-50 text-brand-700"
            >
              {{ s.label }}
            </NuxtLink>
            <span
              v-else
              class="flex items-center justify-between rounded-lg px-3 py-2 text-gray-400"
              aria-disabled="true"
            >
              {{ s.label }}
              <span class="text-xs">{{ t('admin.coming_soon') }}</span>
            </span>
          </li>
        </ul>
      </nav>
      <div class="flex flex-col gap-2 border-t border-gray-200 p-4">
        <LayoutLocaleSwitcher />
        <NuxtLink :to="localePath('/')" class="btn-ghost justify-start">{{ t('admin.back_to_store') }}</NuxtLink>
        <button type="button" class="btn-secondary" @click="signOut">{{ t('nav.logout') }}</button>
      </div>
    </aside>

    <main id="main" class="flex-1 px-4 py-8 sm:px-6 lg:px-10">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { isLoggedIn, isAdmin, fetchProfile, signOut } = useAuth()
const { data: store } = await useStoreSettings()

// Carga el perfil (rol) si hay sesión, para mostrar el acceso al panel.
if (isLoggedIn.value) await fetchProfile().catch(() => null)

const menuOpen = ref(false)
watch(() => route.fullPath, () => { menuOpen.value = false })

const links = computed(() => [
  { to: localePath('/'), label: t('nav.home') },
  { to: localePath('/products'), label: t('nav.products') },
  { to: localePath('/about'), label: t('nav.about') },
])
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <NuxtLink :to="localePath('/')" class="text-lg font-bold tracking-tight text-gray-900">
        {{ store?.store_name || 'Shop' }}
      </NuxtLink>

      <nav :aria-label="t('nav.main')" class="hidden md:block">
        <ul class="flex items-center gap-6 text-sm font-medium text-gray-700">
          <li v-for="link in links" :key="link.to">
            <NuxtLink :to="link.to" class="hover:text-brand-700" active-class="text-brand-700">
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="hidden items-center gap-3 md:flex">
        <LayoutLocaleSwitcher />
        <template v-if="isLoggedIn">
          <NuxtLink v-if="isAdmin" :to="localePath('/admin')" class="btn-ghost">
            {{ t('nav.admin') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/account')" class="btn-ghost">
            {{ t('nav.account') }}
          </NuxtLink>
          <button type="button" class="btn-secondary" @click="signOut">
            {{ t('nav.logout') }}
          </button>
        </template>
        <NuxtLink v-else :to="localePath('/auth/login')" class="btn-primary">
          {{ t('nav.login') }}
        </NuxtLink>
      </div>

      <button
        type="button"
        class="btn-ghost md:hidden"
        :aria-expanded="menuOpen"
        aria-controls="mobile-menu"
        :aria-label="menuOpen ? t('nav.close_menu') : t('nav.open_menu')"
        @click="menuOpen = !menuOpen"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path v-if="!menuOpen" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div v-show="menuOpen" id="mobile-menu" class="border-t border-gray-200 px-4 pb-4 md:hidden">
      <nav :aria-label="t('nav.main')">
        <ul class="flex flex-col gap-1 py-3 text-base font-medium text-gray-800">
          <li v-for="link in links" :key="link.to">
            <NuxtLink :to="link.to" class="block rounded-lg px-3 py-2 hover:bg-gray-100">{{ link.label }}</NuxtLink>
          </li>
          <li v-if="isLoggedIn && isAdmin">
            <NuxtLink :to="localePath('/admin')" class="block rounded-lg px-3 py-2 hover:bg-gray-100">{{ t('nav.admin') }}</NuxtLink>
          </li>
          <li v-if="isLoggedIn">
            <NuxtLink :to="localePath('/account')" class="block rounded-lg px-3 py-2 hover:bg-gray-100">{{ t('nav.account') }}</NuxtLink>
          </li>
        </ul>
      </nav>
      <div class="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
        <LayoutLocaleSwitcher />
        <button v-if="isLoggedIn" type="button" class="btn-secondary" @click="signOut">{{ t('nav.logout') }}</button>
        <NuxtLink v-else :to="localePath('/auth/login')" class="btn-primary">{{ t('nav.login') }}</NuxtLink>
      </div>
    </div>
  </header>
</template>

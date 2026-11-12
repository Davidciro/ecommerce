<script setup lang="ts">
import type { AppLocale } from '~/composables/useAuth'

const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const localePath = useLocalePath()
const { isLoggedIn, profile, updateProfile } = useAuth()

const available = computed(() =>
  locales.value.map((l) => {
    const item = typeof l === 'string' ? { code: l, name: l, language: l } : l
    // En rutas sin equivalente (p. ej. página de error 404) switchLocalePath devuelve '':
    // en ese caso se enlaza a la portada del idioma elegido.
    const to = switchLocalePath(item.code) || localePath('/', item.code)
    return { ...item, to }
  }),
)

// Guarda el idioma elegido en el perfil para emails y comunicaciones (no bloquea la navegación).
function onSelect(code: string) {
  if (isLoggedIn.value && profile.value && profile.value.preferred_locale !== code) {
    void updateProfile({ preferred_locale: code as AppLocale })
  }
}
</script>

<template>
  <nav :aria-label="t('locale.label')">
    <ul class="flex items-center gap-1 text-sm">
      <li v-for="l in available" :key="l.code">
        <NuxtLink
          :to="l.to"
          :hreflang="l.language"
          :lang="l.language"
          :aria-current="l.code === locale ? 'true' : undefined"
          :aria-label="t('locale.switch_to', { language: l.name })"
          class="rounded-md px-2 py-1 font-medium uppercase transition-colors"
          :class="l.code === locale ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'"
          @click="onSelect(l.code)"
        >
          {{ l.code }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

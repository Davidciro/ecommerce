<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const localePath = useLocalePath()

const code = computed(() => props.error?.statusCode ?? 500)
const kind = computed(() => (code.value === 403 ? '403' : code.value === 404 ? '404' : '500'))

useSeoMeta({
  title: () => t(`errors.${kind.value}_title`),
  robots: 'noindex, nofollow',
})

function goHome() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <NuxtLayout>
    <section class="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p class="text-sm font-semibold text-brand-700">{{ code }}</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{{ t(`errors.${kind}_title`) }}</h1>
      <p class="mt-4 text-gray-600">{{ t(`errors.${kind}_body`) }}</p>
      <button type="button" class="btn-primary mt-8" @click="goHome">{{ t('errors.go_home') }}</button>
    </section>
  </NuxtLayout>
</template>

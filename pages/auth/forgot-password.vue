<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const { t } = useI18n()
const localePath = useLocalePath()
const { sendPasswordReset } = useAuth()

useSeoMeta({ title: () => t('auth.forgot.title') })

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorKey = ref<string | null>(null)

async function onSubmit() {
  errorKey.value = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    errorKey.value = 'auth.errors.invalid_email'
    return
  }
  loading.value = true
  const { error } = await sendPasswordReset(email.value)
  loading.value = false
  // Mismo mensaje exista o no la cuenta (evita enumeración de usuarios); solo se muestran límites de envío.
  if (error && authErrorKey(error) === 'auth.errors.rate_limited') {
    errorKey.value = 'auth.errors.rate_limited'
    return
  }
  sent.value = true
}
</script>

<template>
  <section class="card">
    <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('auth.forgot.title') }}</h1>
    <p class="mt-1 mb-6 text-sm text-gray-600">{{ t('auth.forgot.subtitle') }}</p>

    <div v-if="sent" role="status" class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      {{ t('auth.forgot.sent') }}
    </div>

    <form v-else class="space-y-5" novalidate @submit.prevent="onSubmit">
      <div v-if="errorKey" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ t(errorKey) }}
      </div>
      <div>
        <label for="forgot-email" class="form-label">{{ t('auth.login.email') }}</label>
        <input id="forgot-email" v-model="email" type="email" autocomplete="email" inputmode="email" required class="form-input">
      </div>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('common.loading') : t('auth.forgot.submit') }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm">
      <NuxtLink :to="localePath('/auth/login')" class="font-semibold text-brand-700 hover:underline">
        {{ t('auth.forgot.back_to_login') }}
      </NuxtLink>
    </p>
  </section>
</template>

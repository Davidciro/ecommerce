<script setup lang="ts">
/**
 * Fija una nueva contraseña. Accesible:
 *  - tras el enlace de recuperación (callback?type=recovery crea una sesión temporal)
 *  - desde "Mi cuenta" para un usuario logueado
 */
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const { isLoggedIn, isAdmin, fetchProfile, updatePassword } = useAuth()

useSeoMeta({ title: () => t('auth.reset.title') })

const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const done = ref(false)
const errorKey = ref<string | null>(null)

async function onSubmit() {
  errorKey.value = null
  if (password.value.length < 8) {
    errorKey.value = 'auth.errors.password_too_short'
    return
  }
  if (password.value !== passwordConfirm.value) {
    errorKey.value = 'auth.errors.password_mismatch'
    return
  }
  loading.value = true
  const { error } = await updatePassword(password.value)
  loading.value = false
  if (error) {
    errorKey.value = authErrorKey(error)
    return
  }
  done.value = true
  await fetchProfile().catch(() => null)
}
</script>

<template>
  <section class="card">
    <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('auth.reset.title') }}</h1>

    <!-- Sin sesión: enlace caducado o acceso directo -->
    <template v-if="!isLoggedIn">
      <p role="alert" class="mt-4 text-sm text-gray-700">{{ t('auth.reset.no_session') }}</p>
      <NuxtLink :to="localePath('/auth/forgot-password')" class="btn-primary mt-6 w-full">
        {{ t('auth.forgot.submit') }}
      </NuxtLink>
    </template>

    <template v-else-if="done">
      <p role="status" class="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {{ t('auth.reset.success') }}
      </p>
      <NuxtLink :to="isAdmin ? localePath('/admin') : localePath('/account')" class="btn-primary mt-6 w-full">
        {{ isAdmin ? t('nav.admin') : t('nav.account') }}
      </NuxtLink>
    </template>

    <form v-else class="mt-6 space-y-5" novalidate @submit.prevent="onSubmit">
      <p class="text-sm text-gray-600">{{ t('auth.reset.subtitle') }}</p>
      <div v-if="errorKey" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ t(errorKey) }}
      </div>
      <AuthPasswordInput id="reset-password" v-model="password" :label="t('auth.reset.new_password')" autocomplete="new-password" />
      <AuthPasswordInput id="reset-password-confirm" v-model="passwordConfirm" :label="t('auth.register.password_confirm')" autocomplete="new-password" />
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('common.saving') : t('auth.reset.submit') }}
      </button>
    </form>
  </section>
</template>

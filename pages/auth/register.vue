<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: 'guest' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { signUp, fetchProfile } = useAuth()

useSeoMeta({ title: () => t('auth.register.title') })

const MIN_PASSWORD = 8
const form = reactive({ fullName: '', email: '', password: '', passwordConfirm: '', acceptTerms: false })
const loading = ref(false)
const errorKey = ref<string | null>(null)
const sentTo = ref<string | null>(null)

const redirectParam = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : undefined))

function validate(): string | null {
  if (!form.fullName.trim() || !form.email.trim() || !form.password) return 'auth.errors.required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'auth.errors.invalid_email'
  if (form.password.length < MIN_PASSWORD) return 'auth.errors.password_too_short'
  if (form.password !== form.passwordConfirm) return 'auth.errors.password_mismatch'
  if (!form.acceptTerms) return 'auth.errors.terms_required'
  return null
}

async function onSubmit() {
  errorKey.value = validate()
  if (errorKey.value) return

  loading.value = true
  try {
    const { error, needsConfirmation } = await signUp({
      email: form.email,
      password: form.password,
      fullName: form.fullName,
      redirect: redirectParam.value,
    })
    if (error) {
      errorKey.value = authErrorKey(error)
      return
    }
    if (needsConfirmation) {
      sentTo.value = form.email.trim().toLowerCase()
      return
    }
    // Confirmación de email desactivada en Supabase: ya hay sesión.
    await fetchProfile(true)
    await navigateTo(safeRedirect(redirectParam.value, localePath('/account')), { replace: true })
  }
  catch {
    errorKey.value = 'auth.errors.generic'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="card">
    <!-- Registro enviado: pedir confirmación por email -->
    <div v-if="sentTo" role="status" class="text-center">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('auth.register.check_email_title') }}</h1>
      <p class="mt-3 text-sm text-gray-600">{{ t('auth.register.check_email_body', { email: sentTo }) }}</p>
      <NuxtLink :to="localePath('/auth/login')" class="btn-secondary mt-6">{{ t('auth.forgot.back_to_login') }}</NuxtLink>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('auth.register.title') }}</h1>
      <p class="mt-1 mb-6 text-sm text-gray-600">{{ t('auth.register.subtitle') }}</p>

      <div class="space-y-6">
        <div v-if="errorKey" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ t(errorKey) }}
        </div>

        <AuthGoogleButton :redirect="redirectParam" @error="errorKey = $event" />

        <form class="space-y-5" novalidate @submit.prevent="onSubmit">
          <div>
            <label for="reg-name" class="form-label">{{ t('auth.register.full_name') }}</label>
            <input id="reg-name" v-model="form.fullName" type="text" autocomplete="name" required maxlength="200" class="form-input">
          </div>
          <div>
            <label for="reg-email" class="form-label">{{ t('auth.register.email') }}</label>
            <input id="reg-email" v-model="form.email" type="email" autocomplete="email" inputmode="email" required class="form-input">
          </div>
          <div>
            <AuthPasswordInput
              id="reg-password"
              v-model="form.password"
              :label="t('auth.register.password')"
              autocomplete="new-password"
              describedby="reg-password-hint"
            />
            <p id="reg-password-hint" class="mt-1 text-xs text-gray-500">{{ t('auth.register.password_hint') }}</p>
          </div>
          <AuthPasswordInput
            id="reg-password-confirm"
            v-model="form.passwordConfirm"
            :label="t('auth.register.password_confirm')"
            autocomplete="new-password"
          />

          <div class="flex items-start gap-3">
            <input id="reg-terms" v-model="form.acceptTerms" type="checkbox" required class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600">
            <label for="reg-terms" class="text-sm text-gray-700">
              <i18n-t keypath="auth.register.accept_terms" tag="span" scope="global">
                <template #terms>
                  <NuxtLink :to="localePath('/legal/terms')" target="_blank" class="font-medium text-brand-700 underline">
                    {{ t('auth.register.terms') }}
                  </NuxtLink>
                </template>
                <template #privacy>
                  <NuxtLink :to="localePath('/legal/privacy')" target="_blank" class="font-medium text-brand-700 underline">
                    {{ t('auth.register.privacy') }}
                  </NuxtLink>
                </template>
              </i18n-t>
            </label>
          </div>

          <button type="submit" class="btn-primary w-full" :disabled="loading">
            {{ loading ? t('common.loading') : t('auth.register.submit') }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-600">
          {{ t('auth.register.have_account') }}
          <NuxtLink :to="localePath('/auth/login')" class="font-semibold text-brand-700 hover:underline">
            {{ t('auth.register.login_link') }}
          </NuxtLink>
        </p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * Formulario de login reutilizado por:
 *  - variant="customer" (/auth/login): email + contraseña + Google + enlace a registro
 *  - variant="admin"    (/admin/login): solo email + contraseña; rechaza cuentas sin rol admin
 */
const props = withDefaults(defineProps<{ variant?: 'customer' | 'admin' }>(), { variant: 'customer' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const supabase = useSupabaseClient()
const { signInWithPassword, profile } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorKey = ref<string | null>(null)

const redirectParam = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : undefined))

async function onSubmit() {
  errorKey.value = null
  if (!email.value || !password.value) {
    errorKey.value = 'auth.errors.required'
    return
  }
  loading.value = true
  try {
    const { error } = await signInWithPassword(email.value, password.value)
    if (error) {
      errorKey.value = authErrorKey(error)
      return
    }

    const isAdmin = profile.value?.role === 'admin'
    if (props.variant === 'admin' && !isAdmin) {
      // Una cuenta de cliente no debe quedar logueada desde el acceso de administración.
      await supabase.auth.signOut()
      errorKey.value = 'auth.admin_login.not_admin'
      return
    }

    const fallback = isAdmin ? localePath('/admin') : localePath('/account')
    await navigateTo(safeRedirect(redirectParam.value, fallback), { replace: true })
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
  <div class="space-y-6">
    <div
      v-if="errorKey"
      role="alert"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ t(errorKey) }}
    </div>

    <AuthGoogleButton v-if="variant === 'customer'" :redirect="redirectParam" @error="errorKey = $event" />

    <form class="space-y-5" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="login-email" class="form-label">{{ t('auth.login.email') }}</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          required
          class="form-input"
        >
      </div>

      <AuthPasswordInput
        id="login-password"
        v-model="password"
        :label="t('auth.login.password')"
        autocomplete="current-password"
      />

      <div class="flex justify-end">
        <NuxtLink :to="localePath('/auth/forgot-password')" class="text-sm font-medium text-brand-700 hover:underline">
          {{ t('auth.login.forgot') }}
        </NuxtLink>
      </div>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('common.loading') : t('auth.login.submit') }}
      </button>
    </form>

    <p v-if="variant === 'customer'" class="text-center text-sm text-gray-600">
      {{ t('auth.login.no_account') }}
      <NuxtLink
        :to="{ path: localePath('/auth/register'), query: redirectParam ? { redirect: redirectParam } : {} }"
        class="font-semibold text-brand-700 hover:underline"
      >
        {{ t('auth.login.register_link') }}
      </NuxtLink>
    </p>
  </div>
</template>

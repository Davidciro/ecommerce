<script setup lang="ts">
/**
 * Destino de: Google OAuth, confirmación de email y recuperación de contraseña.
 * Supabase usa PKCE: llega ?code=... (o ?token_hash=&type= si se personalizan
 * las plantillas de email). El intercambio se hace en el navegador, donde está
 * el code_verifier guardado en cookie.
 */
import type { EmailOtpType } from '@supabase/supabase-js'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { fetchProfile } = useAuth()

useSeoMeta({ title: () => t('auth.callback.processing') })

const failed = ref(false)

onMounted(async () => {
  const q = route.query
  if (q.error || q.error_description) {
    failed.value = true
    return
  }

  try {
    if (typeof q.token_hash === 'string' && typeof q.type === 'string') {
      const { error } = await supabase.auth.verifyOtp({ token_hash: q.token_hash, type: q.type as EmailOtpType })
      if (error) throw error
    }
    else if (typeof q.code === 'string') {
      // El cliente puede haber hecho ya el intercambio automáticamente al iniciarse.
      const { data: existing } = await supabase.auth.getSession()
      if (!existing.session) {
        const { error } = await supabase.auth.exchangeCodeForSession(q.code)
        if (error) throw error
      }
    }

    const { data: claims } = await supabase.auth.getClaims()
    if (!claims?.claims) throw new Error('no_session')
    user.value = claims.claims

    if (q.type === 'recovery') {
      await navigateTo(localePath('/auth/reset-password'), { replace: true })
      return
    }

    const profile = await fetchProfile(true)
    const fallback = profile?.role === 'admin' ? localePath('/admin') : localePath('/account')
    await navigateTo(safeRedirect(q.redirect, fallback), { replace: true })
  }
  catch {
    failed.value = true
  }
})
</script>

<template>
  <section class="card text-center">
    <template v-if="!failed">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" aria-hidden="true" />
      <h1 class="mt-4 text-lg font-semibold text-gray-900" role="status">{{ t('auth.callback.processing') }}</h1>
    </template>
    <template v-else>
      <h1 class="text-lg font-semibold text-gray-900" role="alert">{{ t('auth.callback.failed') }}</h1>
      <NuxtLink :to="localePath('/auth/login')" class="btn-primary mt-6">{{ t('nav.login') }}</NuxtLink>
    </template>
  </section>
</template>

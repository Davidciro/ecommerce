<script setup lang="ts">
import type { AppLocale } from '~/composables/useAuth'

definePageMeta({ middleware: 'auth' })

const { t, locales } = useI18n()
const localePath = useLocalePath()
const supabase = useSupabaseClient()
const { profile, displayName, fetchProfile, updateProfile, signOut } = useAuth()

useSeoMeta({ title: () => t('account.title'), robots: 'noindex, nofollow' })

await fetchProfile()

// ---- Datos personales -------------------------------------------------------
const form = reactive({
  full_name: profile.value?.full_name ?? '',
  phone: profile.value?.phone ?? '',
  preferred_locale: (profile.value?.preferred_locale ?? 'fr') as AppLocale,
})
const saving = ref(false)
const saved = ref(false)
const errorKey = ref<string | null>(null)

const localeOptions = computed(() =>
  locales.value.map(l => (typeof l === 'string' ? { code: l, name: l } : { code: l.code, name: l.name ?? l.code })),
)

async function saveProfile() {
  saving.value = true
  saved.value = false
  errorKey.value = null
  const { error } = await updateProfile({
    full_name: form.full_name.trim() || null,
    phone: form.phone.trim() || null,
    preferred_locale: form.preferred_locale,
  })
  saving.value = false
  if (error) errorKey.value = 'auth.errors.generic'
  else saved.value = true
}

// ---- Newsletter (RLS: el usuario solo ve su fila; el cambio va por RPC) -----
const { data: newsletterStatus, refresh: refreshNewsletter } = await useAsyncData('auth:newsletter', async () => {
  const { data } = await supabase.from('newsletter_subscribers').select('status').maybeSingle()
  return data?.status ?? 'none'
})
const newsletterBusy = ref(false)
const newsletterOn = computed(() => newsletterStatus.value === 'subscribed')

async function toggleNewsletter() {
  newsletterBusy.value = true
  await supabase.rpc('set_my_newsletter_subscription', {
    p_subscribed: !newsletterOn.value,
    p_locale: form.preferred_locale,
  })
  await refreshNewsletter()
  newsletterBusy.value = false
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <h1 class="text-3xl font-bold tracking-tight text-gray-900">{{ t('account.title') }}</h1>
    <p class="mt-2 text-gray-600">{{ t('account.greeting', { name: displayName }) }}</p>

    <div class="mt-10 space-y-8">
      <!-- Datos personales -->
      <section class="card" aria-labelledby="profile-heading">
        <h2 id="profile-heading" class="text-lg font-semibold text-gray-900">{{ t('account.profile_title') }}</h2>
        <form class="mt-6 grid gap-5 sm:grid-cols-2" @submit.prevent="saveProfile">
          <div class="sm:col-span-2">
            <label for="acc-email" class="form-label">{{ t('account.email') }}</label>
            <input id="acc-email" :value="profile?.email" type="email" disabled class="form-input bg-gray-50 text-gray-500">
          </div>
          <div>
            <label for="acc-name" class="form-label">{{ t('account.full_name') }}</label>
            <input id="acc-name" v-model="form.full_name" type="text" autocomplete="name" maxlength="200" class="form-input">
          </div>
          <div>
            <label for="acc-phone" class="form-label">
              {{ t('account.phone') }} <span class="font-normal text-gray-400">({{ t('common.optional') }})</span>
            </label>
            <input id="acc-phone" v-model="form.phone" type="tel" autocomplete="tel" maxlength="40" class="form-input">
          </div>
          <div>
            <label for="acc-locale" class="form-label">{{ t('account.language') }}</label>
            <select id="acc-locale" v-model="form.preferred_locale" class="form-input">
              <option v-for="l in localeOptions" :key="l.code" :value="l.code">{{ l.name }}</option>
            </select>
          </div>
          <div class="flex items-center gap-4 sm:col-span-2">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? t('common.saving') : t('common.save') }}
            </button>
            <p v-if="saved" role="status" class="text-sm text-green-700">{{ t('common.saved') }}</p>
            <p v-if="errorKey" role="alert" class="text-sm text-red-600">{{ t(errorKey) }}</p>
          </div>
        </form>
      </section>

      <!-- Newsletter -->
      <section class="card" aria-labelledby="newsletter-heading">
        <h2 id="newsletter-heading" class="text-lg font-semibold text-gray-900">{{ t('account.newsletter_title') }}</h2>
        <p class="mt-1 text-sm text-gray-600">{{ t('account.newsletter_desc') }}</p>
        <label class="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            :checked="newsletterOn"
            :disabled="newsletterBusy"
            class="h-4 w-4 rounded border-gray-300 text-brand-600"
            @change="toggleNewsletter"
          >
          <span class="text-sm text-gray-800">{{ t('account.newsletter_on') }}</span>
        </label>
      </section>

      <!-- Pedidos (Fase 4) -->
      <section class="card" aria-labelledby="orders-heading">
        <h2 id="orders-heading" class="text-lg font-semibold text-gray-900">{{ t('account.orders_title') }}</h2>
        <p class="mt-2 text-sm text-gray-600">{{ t('account.orders_soon') }}</p>
      </section>

      <!-- Seguridad -->
      <section class="card flex flex-wrap items-center justify-between gap-4" aria-labelledby="security-heading">
        <h2 id="security-heading" class="text-lg font-semibold text-gray-900">{{ t('account.security_title') }}</h2>
        <div class="flex gap-3">
          <NuxtLink :to="localePath('/auth/reset-password')" class="btn-secondary">{{ t('account.change_password') }}</NuxtLink>
          <button type="button" class="btn-ghost" @click="signOut">{{ t('nav.logout') }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

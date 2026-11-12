<script setup lang="ts">
// Acceso del dueño de la tienda. No hay registro público de administradores:
// la cuenta se crea en Supabase y se promociona con role = 'admin' (ver supabase/seed.sql).
definePageMeta({ layout: 'auth', middleware: 'guest' })

const { t } = useI18n()
useSeoMeta({ title: () => t('auth.admin_login.title') })
</script>

<template>
  <section class="card">
    <h1 class="text-2xl font-bold tracking-tight text-gray-900">{{ t('auth.admin_login.title') }}</h1>
    <p class="mt-1 mb-6 text-sm text-gray-600">{{ t('auth.admin_login.subtitle') }}</p>
    <AuthLoginForm variant="admin" />
  </section>
</template>

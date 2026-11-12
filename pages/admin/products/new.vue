<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('adm.products.new') })
</script>

<template>
  <AdminProductForm />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  validate: route => /^[0-9a-f-]{36}$/i.test(String(route.params.id)),
})
const { t } = useI18n()
const route = useRoute()
useSeoMeta({ title: () => t('adm.products.edit') })
</script>

<template>
  <AdminProductForm :key="String(route.params.id)" :product-id="String(route.params.id)" />
</template>

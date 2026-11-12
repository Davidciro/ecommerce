<script setup lang="ts">
const page = defineModel<number>({ required: true })
const props = defineProps<{ total: number, pageSize: number }>()
const { t } = useI18n()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <nav v-if="pages > 1" class="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
    <button type="button" class="btn-secondary" :disabled="page <= 1" @click="page--">{{ t('adm.common.prev') }}</button>
    <span class="text-gray-600">{{ t('adm.common.page_of', { page, pages }) }}</span>
    <button type="button" class="btn-secondary" :disabled="page >= pages" @click="page++">{{ t('adm.common.next') }}</button>
  </nav>
</template>

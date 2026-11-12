<script setup lang="ts">
const props = defineProps<{ kind: 'order' | 'payment' | 'campaign', value: string }>()
const { t } = useI18n()

const styles: Record<string, string> = {
  // pedidos
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_progress: 'bg-blue-50 text-blue-800 ring-blue-200',
  shipped: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  completed: 'bg-green-50 text-green-800 ring-green-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
  // pagos
  paid: 'bg-green-50 text-green-800 ring-green-200',
  unpaid: 'bg-red-50 text-red-800 ring-red-200',
  refunded: 'bg-gray-100 text-gray-700 ring-gray-200',
  partially_refunded: 'bg-gray-100 text-gray-700 ring-gray-200',
  // campañas
  draft: 'bg-gray-100 text-gray-700 ring-gray-200',
  scheduled: 'bg-blue-50 text-blue-800 ring-blue-200',
  sending: 'bg-blue-50 text-blue-800 ring-blue-200',
  sent: 'bg-green-50 text-green-800 ring-green-200',
  failed: 'bg-red-50 text-red-800 ring-red-200',
}

const label = computed(() => {
  const ns = props.kind === 'order' ? 'adm.orders.status' : props.kind === 'payment' ? 'adm.orders.payment' : 'adm.campaigns.status'
  return t(`${ns}.${props.value}`)
})
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset" :class="styles[value] ?? styles.draft">
    {{ label }}
  </span>
</template>

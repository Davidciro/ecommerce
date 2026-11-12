<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const toast = useToast()

useSeoMeta({ title: () => t('adm.messages.title') })

const showHandled = ref(false)
const { data: messages, pending, refresh } = await useAsyncData(
  'adm:messages',
  async () => {
    let q = supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200)
    if (!showHandled.value) q = q.eq('is_handled', false)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },
  { watch: [showHandled] },
)

async function toggle(id: string, handled: boolean) {
  const { error } = await supabase
    .from('contact_messages')
    .update({ is_handled: handled, handled_at: handled ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) toast.error(t('adm.common.error'))
  else await refresh()
}
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <AdminPageHeader :title="t('adm.messages.title')" :description="t('adm.messages.intro')">
      <template #actions>
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="showHandled" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600">
          {{ t('adm.messages.show_handled') }}
        </label>
      </template>
    </AdminPageHeader>

    <ul class="space-y-4" :class="{ 'opacity-60': pending }">
      <li v-for="m in messages" :key="m.id" class="card" :class="m.is_handled ? 'opacity-70' : ''">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-gray-900">{{ m.name }} <span class="text-xs font-normal uppercase text-gray-400">{{ m.locale }}</span></p>
            <p class="text-sm text-gray-600">
              <a :href="`mailto:${m.email}`" class="text-brand-700 hover:underline">{{ m.email }}</a>
              <template v-if="m.phone"> · {{ m.phone }}</template>
            </p>
          </div>
          <p class="text-xs text-gray-500">{{ formatDate(m.created_at, locale, true) }}</p>
        </div>
        <p v-if="m.subject" class="mt-3 font-medium text-gray-800">{{ m.subject }}</p>
        <p class="mt-2 whitespace-pre-line text-sm text-gray-700">{{ m.message }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <a :href="`mailto:${m.email}?subject=${encodeURIComponent(m.subject ? `Re: ${m.subject}` : '')}`" class="btn-secondary">{{ t('adm.messages.reply') }}</a>
          <button v-if="!m.is_handled" type="button" class="btn-ghost" @click="toggle(m.id, true)">{{ t('adm.messages.mark_handled') }}</button>
          <button v-else type="button" class="btn-ghost" @click="toggle(m.id, false)">{{ t('adm.messages.mark_unhandled') }}</button>
        </div>
      </li>
      <li v-if="!pending && !messages?.length" class="card text-center text-gray-500">{{ t('adm.messages.empty') }}</li>
    </ul>
  </div>
</template>

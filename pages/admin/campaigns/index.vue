<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<Database>()
const localePath = useLocalePath()

useSeoMeta({ title: () => t('adm.campaigns.title') })

const { data: campaigns, pending } = await useAsyncData('adm:campaigns', async () => {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('id, name, status, segment, recipients_count, sent_count, failed_count, sent_at, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
})

function segmentLabel(segment: unknown) {
  const s = (segment ?? {}) as { type?: string, locales?: string[] }
  const type = t(`adm.campaigns.segment_type.${s.type ?? 'all_subscribers'}`)
  return s.locales?.length ? `${type} · ${s.locales.map(l => l.toUpperCase()).join(', ')}` : type
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <AdminPageHeader :title="t('adm.campaigns.title')" :description="t('adm.campaigns.intro')">
      <template #actions>
        <NuxtLink :to="localePath('/admin/campaigns/new')" class="btn-primary">+ {{ t('adm.campaigns.new') }}</NuxtLink>
      </template>
    </AdminPageHeader>

    <div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" class="px-4 py-3">{{ t('adm.campaigns.col_name') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.campaigns.col_segment') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.campaigns.col_status') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.campaigns.col_result') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('adm.campaigns.col_date') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100" :class="{ 'opacity-60': pending }">
          <tr v-for="c in campaigns" :key="c.id" class="hover:bg-gray-50">
            <td class="px-4 py-3">
              <NuxtLink :to="localePath(`/admin/campaigns/${c.id}`)" class="font-medium text-gray-900 hover:text-brand-700">{{ c.name }}</NuxtLink>
            </td>
            <td class="px-4 py-3 text-gray-600">{{ segmentLabel(c.segment) }}</td>
            <td class="px-4 py-3"><AdminStatusBadge kind="campaign" :value="c.status" /></td>
            <td class="px-4 py-3 text-gray-600">
              <template v-if="c.status === 'sent' || c.status === 'failed'">{{ t('adm.campaigns.sent_result', { sent: c.sent_count, failed: c.failed_count }) }}</template>
              <template v-else>—</template>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-gray-600">{{ formatDate(c.sent_at ?? c.created_at, locale, true) }}</td>
          </tr>
          <tr v-if="!pending && !campaigns?.length">
            <td colspan="5" class="px-4 py-12 text-center text-gray-500">{{ t('adm.campaigns.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { StatusBadge, UsageBar, formatDateTime, formatIndustryLabel } from '@/components/admin/shared'
import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { TenantConfigTab } from '@/app/(dashboard)/settings/page'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken } from '@/lib/hooks'

export function AgencyClientProfile() {
  const params = useParams<{ id: string }>()
  const tenantId = decodeURIComponent(params.id)
  const getToken = useApiToken()
  const detail = useApiData((token) => api.admin.getTenant(token, tenantId), [tenantId])
  const bookings = useApiData((token) => api.admin.listTenantBookings(token, tenantId), [tenantId])
  const conversations = useApiData(
    (token) => api.admin.listTenantConversations(token, tenantId),
    [tenantId],
  )

  async function suspend() {
    try {
      const token = await getToken()
      await api.admin.suspend(token, tenantId)
      toast.success('Client suspended')
      await detail.refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not suspend this client.')
    }
  }

  if (detail.loading && !detail.data) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }
  if (detail.error || !detail.data) {
    return <p className="text-sm text-red-600">{detail.error || 'Could not load this client.'}</p>
  }
  const client = detail.data

  return (
    <PageShell>
      <Link href="/admin/clients" className="text-sm text-zinc-500 hover:text-zinc-800">
        All clients
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">{client.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatIndustryLabel(client.industry_type)} · {client.plan?.name ?? 'No credit pack'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={client.account_status} />
          {client.account_status === 'active' ? (
            <Button outline onClick={() => void suspend()}>
              Suspend
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Bookings" value={String(client.bookings_count)} />
        <Metric label="Calls" value={String(client.calls_count)} />
        <Metric label="Conversations" value={String(client.conversations_count)} />
      </div>

      <section className={`${dashCardClass} space-y-3 p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Usage</h2>
        <UsageBar used={client.usage.call_minutes_used} quota={client.usage.call_minutes_quota} label="Minutes" />
        <UsageBar
          used={client.usage.messages_used}
          quota={client.plan?.messages_unlimited ? 0 : client.usage.messages_quota}
          label={client.plan?.messages_unlimited ? 'Messages (unlimited)' : 'Messages'}
        />
      </section>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Bookings</h2>
        {bookings.loading ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : null}
        {bookings.error ? <p className="mt-3 text-sm text-red-600">{bookings.error}</p> : null}
        {!bookings.loading && (bookings.data?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No bookings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {(bookings.data ?? []).map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium text-zinc-950 dark:text-white">{booking.customer_name}</span>
                  <span className="mt-0.5 block text-zinc-500">{booking.service_type} · {booking.status}</span>
                </span>
                <span className="text-zinc-500">{formatDateTime(booking.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Recent conversations</h2>
        {conversations.loading ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : null}
        {conversations.error ? <p className="mt-3 text-sm text-red-600">{conversations.error}</p> : null}
        {!conversations.loading && (conversations.data?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No conversations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {(conversations.data ?? []).slice(0, 20).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium text-zinc-950 dark:text-white">
                    {row.customer_display_name || row.customer_label_name || row.channel}
                  </span>
                  <span className="mt-0.5 block text-zinc-500">{row.outcome}</span>
                </span>
                <span className="text-zinc-500">{formatDateTime(row.updated_at || row.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Company profile</h2>
        <BusinessSettings tenantId={tenantId} />
      </section>
    </PageShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${dashCardClass} p-5`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">{value}</p>
    </div>
  )
}

function BusinessSettings({ tenantId }: { tenantId: string }) {
  const getToken = useApiToken()
  const { data, loading, error, refetch } = useApiData(
    (token) => api.admin.getTenantSettings(token, tenantId),
    [tenantId],
  )
  const saveSettings = useCallback(
    (token: string, body: Record<string, unknown>) => api.admin.updateTenantSettings(token, tenantId, body),
    [tenantId],
  )
  const loadTimezones = useCallback(
    (token: string) => api.admin.listTenantTimezones(token, tenantId),
    [tenantId],
  )
  if (loading && !data) return <SkeletonBlock className="mt-4 h-40" />
  if (error || !data) return <p className="mt-3 text-sm text-red-600">{error || 'Could not load the profile.'}</p>
  return (
    <TenantConfigTab
      mode="customer"
      tenant={data}
      credentials={[]}
      onSaved={() => void refetch()}
      saveSettings={saveSettings}
      loadTimezones={loadTimezones}
      weeklyReportEnabled={data.weekly_report_enabled !== false}
      onWeeklyReportChange={async (enabled) => {
        const token = await getToken()
        await api.admin.setWeeklyReportEnabled(token, tenantId, enabled)
      }}
    />
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import {
  AgencyRangeChart,
  ClientPerformanceTable,
  DashboardCard,
  RecentActivityList,
  attentionReason,
  messagesRemaining,
  minutesRemaining,
} from '@/components/admin/agency-dashboard'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AdminTenant } from '@/lib/types'

export function AgencyHome() {
  const [days, setDays] = useState<7 | 30>(30)
  const clientsQuery = useApiData((token) => api.admin.listTenants(token), [])
  const activityQuery = useApiData((token) => api.admin.agencyActivity(token, days), [days])
  const clients = clientsQuery.data ?? []
  const attention = clients
    .map((client) => ({ client, reason: attentionReason(client) }))
    .filter((item): item is { client: AdminTenant; reason: string } => item.reason !== null)
  const counts = useMemo(() => {
    const map = new Map<string, { bookings: number; calls: number; messages: number }>()
    for (const row of activityQuery.data?.clients ?? []) map.set(row.tenant_id, row)
    return map
  }, [activityQuery.data])
  const minuteUsed = clients.reduce((sum, client) => sum + (client.usage?.call_minutes_used ?? 0), 0)
  const minuteLeft = clients.reduce((sum, client) => sum + minutesRemaining(client), 0)
  const messageUsed = clients.reduce((sum, client) => sum + (client.usage?.messages_used ?? 0), 0)
  const finiteMessages = clients.map(messagesRemaining).filter((value): value is number => value !== null)
  const anyUnlimited = clients.some((client) => client.plan?.messages_unlimited)
  const bookings = clients.reduce((sum, client) => sum + (client.bookings_this_month ?? 0), 0)
  const active = clients.filter((client) => client.account_status === 'active').length
  const pending = clients.filter((client) => client.account_status === 'pending').length
  const suspended = clients.filter((client) => client.account_status === 'suspended').length

  if (clientsQuery.loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Overview" description="Your clients, their usage, and what needs a look." />
      {clientsQuery.error ? <p className="text-sm text-red-600">{clientsQuery.error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi href="/admin/clients" label="Clients" value={`${active} active · ${pending} pending · ${suspended} suspended`} />
        <Kpi href="/admin/activity" label="Bookings this month" value={String(bookings)} />
        <Kpi href="/admin/credits" label="Call minutes" value={`${minuteUsed} used · ${minuteLeft} remaining`} />
        <Kpi
          href="/admin/credits"
          label="Messages"
          value={
            anyUnlimited
              ? `${messageUsed} used · ${finiteMessages.reduce((sum, value) => sum + value, 0)} remaining on limited packs`
              : `${messageUsed} used · ${finiteMessages.reduce((sum, value) => sum + value, 0)} remaining`
          }
        />
        <Kpi href="/admin/credits" label="Minutes remaining" value={String(minuteLeft)} />
        <Kpi href="/admin/clients" label="Needs attention" value={String(attention.length)} />
      </div>

      <DashboardCard title="Booking activity">
        <RangeToggle days={days} onChange={setDays} />
        {activityQuery.loading ? (
          <SkeletonBlock className="mt-4 h-64" />
        ) : activityQuery.error ? (
          <p className="mt-3 text-sm text-red-600">{activityQuery.error}</p>
        ) : (
          <div className="mt-4">
            <AgencyRangeChart series={activityQuery.data?.series ?? []} />
          </div>
        )}
      </DashboardCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardCard title="Client performance">
          <ClientPerformanceTable clients={clients} counts={counts} />
        </DashboardCard>
        <DashboardCard title="Needs attention">
          {attention.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing is waiting.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {attention.map(({ client, reason }) => (
                <li key={client.id}>
                  <Link
                    href={`/admin/clients/${encodeURIComponent(client.id)}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span className="truncate font-medium text-zinc-950 dark:text-white">{client.name}</span>
                    <span className="shrink-0 text-zinc-500">{reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      <DashboardCard title="Recent activity">
        {activityQuery.loading ? (
          <SkeletonBlock className="h-24" />
        ) : (
          <RecentActivityList events={activityQuery.data?.recent ?? []} />
        )}
      </DashboardCard>
    </PageShell>
  )
}

function Kpi({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className={`${dashCardClass} block p-5 transition-shadow hover:shadow-md`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{value}</p>
    </Link>
  )
}

export function RangeToggle({ days, onChange }: { days: 7 | 30; onChange: (days: 7 | 30) => void }) {
  return (
    <div className="flex gap-2">
      {([7, 30] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={
            days === option
              ? 'rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-950'
              : 'rounded-full px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 dark:text-zinc-300 dark:ring-zinc-700'
          }
        >
          Last {option} days
        </button>
      ))}
    </div>
  )
}

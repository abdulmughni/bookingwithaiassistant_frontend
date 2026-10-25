'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/20/solid'

import {
  AgencyRangeChart,
  ClientPerformanceTable,
  DashboardCard,
  RecentActivityList,
  attentionReason,
} from '@/components/admin/agency-dashboard'
import { AdminAlertPanel } from '@/components/admin/ops'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AdminAlert, AdminTenant } from '@/lib/types'

function alertKey(alert: Pick<AdminAlert, 'tenant_id' | 'rule_key'>) {
  return `${alert.tenant_id}:${alert.rule_key}`
}

export function AgencyHome() {
  const [days, setDays] = useState<7 | 30>(30)
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(() => new Set())
  const clientsQuery = useApiData((token) => api.admin.listTenants(token), [])
  const activityQuery = useApiData((token) => api.admin.agencyActivity(token, days), [days])
  const alertsQuery = useApiData((token) => api.admin.agencyAlerts(token), [])
  const clients = clientsQuery.data ?? []
  const attention = clients
    .map((client) => ({ client, reason: attentionReason(client) }))
    .filter((item): item is { client: AdminTenant; reason: string } => item.reason !== null)
  const counts = useMemo(() => {
    const map = new Map<string, { bookings: number; calls: number; messages: number }>()
    for (const row of activityQuery.data?.clients ?? []) map.set(row.tenant_id, row)
    return map
  }, [activityQuery.data])
  const visibleAlerts = useMemo(
    () => (alertsQuery.data ?? []).filter((alert) => !sessionDismissed.has(alertKey(alert))),
    [alertsQuery.data, sessionDismissed],
  )
  const bookings = clients.reduce((sum, client) => sum + (client.bookings_count ?? 0), 0)
  const conversations = clients.reduce((sum, client) => sum + (client.conversations_count ?? 0), 0)
  const calls = (activityQuery.data?.series ?? []).reduce((sum, point) => sum + point.calls, 0)
  const messages = (activityQuery.data?.series ?? []).reduce((sum, point) => sum + point.messages, 0)
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
      {alertsQuery.error ? <p className="text-sm text-red-600">{alertsQuery.error}</p> : null}
      {!alertsQuery.loading && !alertsQuery.error ? (
      <AdminAlertPanel
        alerts={visibleAlerts}
        onDismiss={(alert) =>
          setSessionDismissed((prev) => {
            const next = new Set(prev)
            next.add(alertKey(alert))
            return next
          })
        }
      />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clients" value={clients.length} href="/admin/clients" />
        <StatCard label="Active" value={active} href="/admin/clients" accent="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Pending activation" value={pending} href="/admin/clients" accent="text-amber-600 dark:text-amber-400" />
        <StatCard label="Suspended" value={suspended} href="/admin/clients" accent="text-red-600 dark:text-red-400" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard icon={<CalendarDaysIcon className="size-5" />} label="Bookings (all time)" value={bookings} />
        <TotalCard icon={<ChatBubbleLeftRightIcon className="size-5" />} label="Conversations" value={conversations} />
        <TotalCard icon={<PhoneIcon className="size-5" />} label={`Calls (last ${days} days)`} value={calls} />
        <TotalCard icon={<EnvelopeIcon className="size-5" />} label={`Messages (last ${days} days)`} value={messages} />
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

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string
  value: number
  href: string
  accent?: string
}) {
  return (
    <Link href={href} className={`${dashCardClass} block p-5 transition-shadow hover:shadow-md`}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${accent ?? 'text-zinc-950 dark:text-white'}`}>
        {value.toLocaleString()}
      </p>
    </Link>
  )
}

function TotalCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className={`${dashCardClass} flex items-center gap-4 p-5`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">{value.toLocaleString()}</p>
      </div>
    </div>
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

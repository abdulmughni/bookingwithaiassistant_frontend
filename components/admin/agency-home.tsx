'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

import { StatusBadge, formatDateTime } from '@/components/admin/shared'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AdminTenant } from '@/lib/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function quietSince(client: AdminTenant, now: number) {
  if (!client.last_activity_at) return true
  const at = new Date(client.last_activity_at).getTime()
  return Number.isNaN(at) || now - at > WEEK_MS
}

function minuteRatio(client: AdminTenant) {
  const quota = client.usage?.call_minutes_quota ?? 0
  if (quota <= 0) return 0
  return (client.usage?.call_minutes_used ?? 0) / quota
}

export function AgencyHome() {
  const { data, loading, error } = useApiData((token) => api.admin.listTenants(token), [])
  const clients = data ?? []
  const now = Date.now()
  const active = clients.filter((client) => client.account_status === 'active').length
  const pending = clients.filter((client) => client.account_status === 'pending').length
  const suspended = clients.filter((client) => client.account_status === 'suspended').length
  const bookings = clients.reduce((sum, client) => sum + (client.bookings_this_month ?? 0), 0)
  const minutes = clients.reduce((sum, client) => sum + (client.usage?.call_minutes_used ?? 0), 0)
  const nearLimit = [...clients]
    .filter((client) => (client.usage?.call_minutes_quota ?? 0) > 0)
    .sort((a, b) => minuteRatio(b) - minuteRatio(a))
    .slice(0, 5)
  const attention = clients.filter(
    (client) =>
      client.account_status === 'suspended' ||
      client.account_status === 'pending' ||
      quietSince(client, now),
  )
  const recent = [...clients].sort((a, b) => {
    const left = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0
    const right = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0
    return right - left
  })

  if (loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Home" description="Your clients, this month." />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clients" value={`${active} active · ${pending} pending · ${suspended} suspended`} />
        <Stat label="Bookings this month" value={String(bookings)} />
        <Stat label="Call minutes this month" value={String(minutes)} />
        <Stat label="Needs attention" value={String(attention.length)} />
      </div>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Closest to the minute limit</h2>
        {nearLimit.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No clients have a minute limit yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {nearLimit.map((client) => (
              <li key={client.id}>
                <ClientLink client={client}>
                  <span>
                    {client.usage.call_minutes_used} / {client.usage.call_minutes_quota} min
                  </span>
                </ClientLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Everyone is active and has been in touch this week.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {attention.map((client) => (
              <li key={client.id}>
                <ClientLink client={client}>
                  <span className="text-zinc-500">
                    {client.account_status === 'suspended'
                      ? 'Suspended'
                      : client.account_status === 'pending'
                        ? 'Pending'
                        : 'No activity in 7 days'}
                  </span>
                </ClientLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No clients yet. Invite one from Clients.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((client) => (
              <li key={client.id}>
                <ClientLink client={client}>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={client.account_status} />
                    <span className="text-zinc-500">{formatDateTime(client.last_activity_at)}</span>
                  </span>
                </ClientLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${dashCardClass} p-5`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{value}</p>
    </div>
  )
}

function ClientLink({ client, children }: { client: AdminTenant; children: ReactNode }) {
  return (
    <Link
      href={`/admin/clients/${encodeURIComponent(client.id)}`}
      className="flex items-center justify-between gap-3 py-3 text-sm font-medium text-zinc-950 hover:text-brand-700 dark:text-white"
    >
      <span className="truncate">{client.name}</span>
      {children}
    </Link>
  )
}

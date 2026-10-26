'use client'

import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  BanknotesIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FireIcon,
  HomeIcon,
  PhoneIcon,
  PlusIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/20/solid'

import {
  AgencyRangeChart,
  attentionReason,
} from '@/components/admin/agency-dashboard'
import { InviteCompanyDialog } from '@/components/admin/invite-company-dialog'
import { StatusBadge, formatDate } from '@/components/admin/shared'
import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { useAgencyBrand, useApiData, useIsAdmin } from '@/lib/hooks'
import type { AdminAlert, AdminTenant, AgencyActivityEvent } from '@/lib/types'

function alertKey(alert: Pick<AdminAlert, 'tenant_id' | 'rule_key'>) {
  return `${alert.tenant_id}:${alert.rule_key}`
}

function timeAgo(iso: string): string {
  const date = new Date(iso)
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (!Number.isFinite(mins) || mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(iso)
}

function industryIcon(industry?: string | null): ComponentType<{ className?: string }> {
  const key = (industry || '').toLowerCase()
  if (key.includes('roof')) return HomeIcon
  if (key.includes('plumb')) return WrenchScrewdriverIcon
  if (key.includes('elect')) return BoltIcon
  if (key.includes('hvac') || key.includes('heat') || key.includes('air')) return FireIcon
  return BuildingOffice2Icon
}

export function AgencyHome() {
  const [days, setDays] = useState<7 | 30>(30)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(() => new Set())
  const { tenantId, isAgencyStaff } = useIsAdmin()
  const { brand } = useAgencyBrand(true)
  const clientsQuery = useApiData((token) => api.admin.listTenants(token), [])
  const activityQuery = useApiData((token) => api.admin.agencyActivity(token, days), [days])
  const alertsQuery = useApiData((token) => api.admin.agencyAlerts(token), [])
  const clients = clientsQuery.data ?? []
  const counts = useMemo(() => {
    const map = new Map<string, { bookings: number; calls: number; messages: number }>()
    for (const row of activityQuery.data?.clients ?? []) map.set(row.tenant_id, row)
    return map
  }, [activityQuery.data])
  const visibleAlerts = useMemo(
    () => (alertsQuery.data ?? []).filter((alert) => !sessionDismissed.has(alertKey(alert))),
    [alertsQuery.data, sessionDismissed],
  )
  const attention = clients
    .map((client) => ({ client, reason: attentionReason(client) }))
    .filter((item): item is { client: AdminTenant; reason: string } => item.reason !== null)
  const bookings = clients.reduce((sum, client) => sum + (client.bookings_count ?? 0), 0)
  const minutes = clients.reduce((sum, client) => sum + (client.usage?.call_minutes_used ?? 0), 0)
  const messages = clients.reduce((sum, client) => sum + (client.usage?.messages_used ?? 0), 0)
  const topClients = [...clients].sort((a, b) => {
    const left = counts.get(b.id)?.bookings ?? b.bookings_count ?? 0
    const right = counts.get(a.id)?.bookings ?? a.bookings_count ?? 0
    return left - right
  })
  const signups = [...clients].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5)
  const agencyName = brand?.company_name || 'Your agency'

  if (clientsQuery.loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-16 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <SkeletonBlock key={item} className="h-24" />
          ))}
        </div>
        <SkeletonBlock className="h-80" />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Welcome back,</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{agencyName}</h1>
          <p className="mt-1 text-sm text-zinc-500">Your clients, their usage, and what needs a look.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RangeToggle days={days} onChange={setDays} />
          {isAgencyStaff || !tenantId ? null : (
            <Button color="brand" onClick={() => setInviteOpen(true)}>
              <PlusIcon data-slot="icon" />
              Add New Client
            </Button>
          )}
        </div>
      </div>

      {clientsQuery.error ? <p className="text-sm text-red-600">{clientsQuery.error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={UsersIcon} tint="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300" label="Total clients" value={clients.length.toLocaleString()} href="/admin/clients" />
        <MetricCard icon={CalendarDaysIcon} tint="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300" label="Total bookings" value={bookings.toLocaleString()} href="/admin/activity?view=bookings" />
        <MetricCard icon={PhoneIcon} tint="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300" label="Call minutes" value={minutes.toLocaleString()} href="/admin/activity?view=calls" />
        <MetricCard icon={EnvelopeIcon} tint="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300" label="Messages" value={messages.toLocaleString()} href="/admin/activity?view=messages" />
        <MetricCard icon={BanknotesIcon} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" label="Revenue this month" value="Not tracked" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className={`${dashCardClass} p-5 xl:col-span-3`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Booking activity</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Bookings and calls across your clients.</p>
            </div>
            <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700">
              Last {days} days
            </span>
          </div>
          {activityQuery.loading ? (
            <SkeletonBlock className="mt-4 h-80" />
          ) : activityQuery.error ? (
            <p className="mt-3 text-sm text-red-600">{activityQuery.error}</p>
          ) : (
            <div className="mt-2">
              <AgencyRangeChart series={activityQuery.data?.series ?? []} variant="dashboard" />
            </div>
          )}
        </section>

        <section className={`${dashCardClass} p-5 xl:col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Top performing clients</h2>
            <Link href="/admin/clients" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          {topClients.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">No clients yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Client</th>
                    <th className="px-2 py-2 font-medium">Bookings</th>
                    <th className="px-2 py-2 font-medium">Calls</th>
                    <th className="px-2 py-2 font-medium">Messages</th>
                    <th className="py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.slice(0, 5).map((client) => {
                    const Icon = industryIcon(client.industry_type)
                    const count = counts.get(client.id)
                    return (
                      <tr key={client.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="py-3 pr-3">
                          <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                              <Icon className="size-4" />
                            </span>
                            <span className="truncate font-medium text-zinc-950 dark:text-white">{client.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-3 tabular-nums">{count?.bookings ?? client.bookings_count ?? 0}</td>
                        <td className="px-2 py-3 tabular-nums">{count?.calls ?? 0}</td>
                        <td className="px-2 py-3 tabular-nums">{count?.messages ?? client.usage?.messages_used ?? 0}</td>
                        <td className="py-3 pl-2">
                          <StatusBadge status={client.account_status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recent client sign-ups" href="/admin/clients">
          {signups.length === 0 ? (
            <p className="text-sm text-zinc-500">No clients yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {signups.map((client) => {
                const Icon = industryIcon(client.industry_type)
                return (
                  <li key={client.id}>
                    <Link
                      href={`/admin/clients/${encodeURIComponent(client.id)}`}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{client.name}</span>
                        <span className="block text-xs text-zinc-500">Joined {formatDate(client.created_at)}</span>
                      </span>
                      <StatusBadge status={client.account_status} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Needs attention" href="/admin/clients" count={visibleAlerts.length + attention.length}>
          {alertsQuery.error ? <p className="text-sm text-red-600">{alertsQuery.error}</p> : null}
          {visibleAlerts.length === 0 && attention.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing is waiting.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibleAlerts.map((alert) => (
                <li key={alertKey(alert)} className="flex items-start gap-3 py-3">
                  <ExclamationTriangleIcon
                    className={alert.severity === 'red' ? 'mt-0.5 size-5 shrink-0 text-red-500' : 'mt-0.5 size-5 shrink-0 text-amber-500'}
                  />
                  <Link href={`/admin/clients/${encodeURIComponent(alert.tenant_id)}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{alert.tenant_name}</span>
                    <span className="block text-xs text-zinc-500">{alert.reason}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-zinc-400">{timeAgo(alert.since)}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                    onClick={() =>
                      setSessionDismissed((prev) => {
                        const next = new Set(prev)
                        next.add(alertKey(alert))
                        return next
                      })
                    }
                  >
                    Dismiss
                  </button>
                </li>
              ))}
              {attention.map(({ client, reason }) => (
                <li key={`${client.id}:${reason}`}>
                  <Link
                    href={`/admin/clients/${encodeURIComponent(client.id)}`}
                    className="flex items-start gap-3 py-3"
                  >
                    <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{client.name}</span>
                      <span className="block text-xs text-zinc-500">{reason}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity" href="/admin/activity">
          {activityQuery.loading ? (
            <SkeletonBlock className="h-24" />
          ) : (activityQuery.data?.recent.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500">No activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {(activityQuery.data?.recent ?? []).map((event) => (
                <ActivityRow key={`${event.kind}-${event.tenant_id}-${event.at}`} event={event} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {tenantId && !isAgencyStaff ? (
        <InviteCompanyDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          title="Invite a client"
          description="They get their own login. You manage their setup from My Clients."
          submitLabel="Send invitation"
          onSubmit={async (token, input) => {
            await api.admin.inviteClient(token, tenantId, input)
            toast.success('Invitation sent')
            await clientsQuery.refetch()
          }}
        />
      ) : null}
    </PageShell>
  )
}

function MetricCard({
  icon: Icon,
  tint,
  label,
  value,
  href,
}: {
  icon: ComponentType<{ className?: string }>
  tint: string
  label: string
  value: string
  href?: string
}) {
  const body = (
    <div className={`${dashCardClass} flex items-center gap-4 p-4`}>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-zinc-500">{label}</span>
        <span className="mt-0.5 block text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{value}</span>
      </span>
    </div>
  )
  if (!href) return body
  return (
    <Link href={href} className="block rounded-xl transition-shadow hover:shadow-md">
      {body}
    </Link>
  )
}

function Panel({
  title,
  href,
  count,
  children,
}: {
  title: string
  href: string
  count?: number
  children: ReactNode
}) {
  return (
    <section className={`${dashCardClass} p-5`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
          {title}
          {count ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
              {count}
            </span>
          ) : null}
        </h2>
        <Link href={href} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          View all
        </Link>
      </div>
      {children}
    </section>
  )
}

function ActivityRow({ event }: { event: AgencyActivityEvent }) {
  const tone =
    event.kind === 'booking'
      ? 'bg-blue-500'
      : event.kind === 'client_joined'
        ? 'bg-emerald-500'
        : event.kind === 'activated'
          ? 'bg-emerald-600'
          : event.kind === 'credits'
            ? 'bg-amber-500'
            : 'bg-zinc-400'
  return (
    <li>
      <Link href={`/admin/clients/${encodeURIComponent(event.tenant_id)}`} className="flex items-start gap-3 py-2">
        <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${tone}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{event.title}</span>
          <span className="block truncate text-xs text-zinc-500">{event.tenant_name}</span>
        </span>
        <span className="shrink-0 text-xs text-zinc-400">{timeAgo(event.at)}</span>
      </Link>
    </li>
  )
}

export function RangeToggle({ days, onChange }: { days: 7 | 30; onChange: (days: 7 | 30) => void }) {
  return (
    <div className="flex rounded-lg bg-white p-1 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      {([7, 30] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={
            days === option
              ? 'rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-950'
              : 'rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300'
          }
        >
          Last {option} days
        </button>
      ))}
    </div>
  )
}

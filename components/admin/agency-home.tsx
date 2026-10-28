'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowUpIcon,
  BanknotesIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/16/solid'

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

import { ActivityBars } from '@/components/activity-bars'
import { attentionReason } from '@/components/admin/agency-dashboard'
import { AgencyNotificationBell } from '@/components/admin/agency-notification-bell'
import { InviteCompanyDialog } from '@/components/admin/invite-company-dialog'
import { StatusBadge, formatDate } from '@/components/admin/shared'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { agencyDemo, agencyDemoSeries, useAgencyDemo } from '@/lib/agency-dashboard-demo'
import { useAgencyBrand, useApiData, useIsAdmin } from '@/lib/hooks'
import type { AdminTenant, AgencyActivityEvent } from '@/lib/types'

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

function localIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  return { start: localIso(start), end: localIso(end) }
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 88
  const height = 36
  if (values.length < 2) {
    return <span className="h-9 w-20 shrink-0" />
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((value, index) => `${index * step},${height - 4 - ((value - min) / span) * (height - 10)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-20 shrink-0" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function chartPreset(kind: 'week' | 'month' | 'year') {
  const end = new Date()
  const start = new Date()
  if (kind === 'week') start.setDate(end.getDate() - 6)
  else if (kind === 'month') start.setDate(end.getDate() - 29)
  else {
    start.setMonth(0, 1)
  }
  return { start: localIso(start), end: localIso(end) }
}

function prettyRange(start: string, end: string) {
  const fmt = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function inRange(iso: string | null | undefined, start: string, end: string) {
  if (!iso) return false
  const day = iso.slice(0, 10)
  return day >= start && day <= end
}

export function AgencyHome() {
  const [range, setRange] = useState(defaultRange)
  const [draft, setDraft] = useState(defaultRange)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const { enabled: demo, setDemo } = useAgencyDemo()
  const { tenantId, isAgencyStaff } = useIsAdmin()
  const { brand } = useAgencyBrand(true)
  const clientsQuery = useApiData((token) => api.admin.listTenants(token), [])
  const activityQuery = useApiData(
    (token) => api.admin.agencyActivity(token, { start: range.start, end: range.end }),
    [range.start, range.end],
  )
  const alertsQuery = useApiData((token) => api.admin.agencyAlerts(token), [])
  const clients = clientsQuery.data ?? []
  const counts = useMemo(() => {
    const map = new Map<string, { bookings: number; calls: number; messages: number }>()
    for (const row of activityQuery.data?.clients ?? []) map.set(row.tenant_id, row)
    return map
  }, [activityQuery.data])
  const agencyName = brand?.company_name || 'Your agency'
  const series = activityQuery.data?.series ?? []

  if (!demo && clientsQuery.loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-16 w-72" />
        <SkeletonBlock className="h-28" />
      </PageShell>
    )
  }

  const bookings = series.reduce((sum, point) => sum + point.bookings, 0)
  const minutes = series.reduce((sum, point) => sum + (point.call_minutes ?? 0), 0)
  const messages = series.reduce((sum, point) => sum + point.messages, 0)
  const clientsInRange = clients.filter((client) => inRange(client.created_at, range.start, range.end)).length
  const kpis = demo
    ? agencyDemo.kpis
    : [
        { label: 'Total clients', value: clientsInRange.toLocaleString(), trend: '' },
        { label: 'Total bookings', value: bookings.toLocaleString(), trend: '' },
        { label: 'Call minutes', value: minutes.toLocaleString(), trend: '' },
        { label: 'Messages', value: messages.toLocaleString(), trend: '' },
        { label: 'Revenue this month', value: 'Not tracked', trend: '' },
      ]
  const icons = [UsersIcon, CalendarDaysIcon, PhoneIcon, EnvelopeIcon, BanknotesIcon]
  const topClients = [...clients].sort((a, b) => (counts.get(b.id)?.bookings ?? 0) - (counts.get(a.id)?.bookings ?? 0)).slice(0, 5)
  const signups = clients
    .filter((client) => inRange(client.created_at, range.start, range.end))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5)
  const attention = clients
    .map((client) => ({ client, reason: attentionReason(client) }))
    .filter((item): item is { client: AdminTenant; reason: string } => item.reason !== null)

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Welcome back,</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-zinc-950">{agencyName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {demo ? agencyDemo.subtitle : 'Your clients, their usage, and what needs a look.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDemo(!demo)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-200"
          >
            <span className={demo ? 'text-blue-600' : 'text-zinc-400'}>{demo ? 'Demo data on' : 'Demo data off'}</span>
            <span className={`relative h-5 w-9 rounded-full ${demo ? 'bg-blue-600' : 'bg-zinc-300'}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${demo ? 'left-4' : 'left-0.5'}`} />
            </span>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraft(range)
                setRangeOpen((open) => !open)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200"
            >
              <CalendarDaysIcon className="size-4 text-zinc-400" />
              {prettyRange(range.start, range.end)}
              <ChevronDownIcon className="size-4 text-zinc-400" />
            </button>
            {rangeOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl bg-white p-3 shadow-lg ring-1 ring-zinc-200">
                <label className="block text-xs font-medium text-zinc-500">
                  From
                  <input
                    type="date"
                    value={draft.start}
                    onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-800"
                  />
                </label>
                <label className="mt-2 block text-xs font-medium text-zinc-500">
                  To
                  <input
                    type="date"
                    value={draft.end}
                    onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-800"
                  />
                </label>
                <Button
                  color="brand"
                  className="mt-3 w-full"
                  onClick={() => {
                    if (!draft.start || !draft.end) return
                    const next = draft.start <= draft.end ? draft : { start: draft.end, end: draft.start }
                    setRange(next)
                    setRangeOpen(false)
                  }}
                >
                  Apply
                </Button>
              </div>
            ) : null}
          </div>
          {isAgencyStaff || !tenantId ? null : (
            <Button color="brand" onClick={() => setInviteOpen(true)}>
              <PlusIcon data-slot="icon" />
              Add New Client
            </Button>
          )}
          <AgencyNotificationBell />
        </div>
      </div>

      {clientsQuery.error && !demo ? <p className="text-sm text-red-600">{clientsQuery.error}</p> : null}

      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi, index) => {
          const Icon = icons[index] ?? UsersIcon
          const cardSeries = demo ? agencyDemoSeries() : series
          const tones = [
            'bg-blue-50 text-blue-600',
            'bg-sky-50 text-sky-600',
            'bg-cyan-50 text-cyan-600',
            'bg-indigo-50 text-indigo-600',
            'bg-emerald-50 text-emerald-600',
          ]
          const strokes = ['#2563eb', '#0284c7', '#0891b2', '#4f46e5', '#059669']
          const spark =
            index === 1
              ? cardSeries.map((point) => point.bookings)
              : index === 2
                ? cardSeries.map((point) => (demo ? point.calls : point.call_minutes ?? 0))
                : index === 3
                  ? cardSeries.map((point) => point.messages)
                  : []
          return (
            <article key={kpi.label} className={`${dashCardClass} flex h-full items-center gap-3 p-4`}>
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tones[index] ?? tones[0]}`}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-500">{kpi.label}</p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-950">{kpi.value}</p>
                <p className="mt-1 flex min-h-4 items-center gap-1 text-xs font-medium text-emerald-600">
                  {kpi.trend ? (
                    <>
                      <ArrowUpIcon className="size-3" />
                      {kpi.trend}
                    </>
                  ) : null}
                </p>
              </div>
              <Sparkline values={spark} color={strokes[index] ?? strokes[0]} />
            </article>
          )
        })}
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-5">
        <div className="h-full xl:col-span-3">
          <ActivityBars
            title="Booking activity"
            subtitle="New bookings across all your clients."
            loading={!demo && activityQuery.loading}
            points={(demo ? agencyDemoSeries() : activityQuery.data?.series ?? []).map((point) => ({
              date: point.date,
              bookings: point.bookings,
              calls: point.calls,
              messages: point.messages,
            }))}
            menu={
              <Menu as="div" className="relative shrink-0">
                <MenuButton className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50">
                  {(() => {
                    const week = chartPreset('week')
                    const month = chartPreset('month')
                    const year = chartPreset('year')
                    if (range.start === week.start && range.end === week.end) return 'Last 7 days'
                    if (range.start === month.start && range.end === month.end) return 'Last 30 days'
                    if (range.start === year.start && range.end === year.end) return 'This year'
                    return prettyRange(range.start, range.end)
                  })()}
                  <ChevronDownIcon className="size-3.5 text-zinc-400" />
                </MenuButton>
                <MenuItems
                  anchor="bottom end"
                  className="z-20 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200 [--anchor-gap:6px] focus:outline-none"
                >
                  {(
                    [
                      ['week', 'Last 7 days'],
                      ['month', 'Last 30 days'],
                      ['year', 'This year'],
                    ] as const
                  ).map(([kind, label]) => (
                    <MenuItem key={kind}>
                      <button
                        type="button"
                        onClick={() => setRange(chartPreset(kind))}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 data-focus:bg-zinc-100"
                      >
                        {label}
                      </button>
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>
            }
          />
          {!demo && activityQuery.error ? <p className="mt-2 text-sm text-red-600">{activityQuery.error}</p> : null}
        </div>

        <section className={`${dashCardClass} flex h-full flex-col p-5 xl:col-span-2`}>
          <PanelHead title="Top performing clients" href="/admin/clients" />
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs text-zinc-400">
              <tr>
                <th className="py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Bookings</th>
                <th className="px-2 py-2 font-medium">Calls</th>
                <th className="px-2 py-2 font-medium">Messages</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {demo
                ? agencyDemo.clients.map((client) => (
                    <tr key={client.id} className="border-t border-zinc-100">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <TradeIcon industry={client.industry} />
                          <span className="truncate font-medium text-zinc-950">{client.name}</span>
                        </span>
                      </td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.bookings}</td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.calls}</td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.messages}</td>
                      <td>
                        <Badge color={client.status === 'Active' ? 'green' : 'amber'}>{client.status}</Badge>
                      </td>
                    </tr>
                  ))
                : topClients.map((client) => {
                    const count = counts.get(client.id)
                    return (
                      <tr key={client.id} className="border-t border-zinc-100">
                        <td className="py-2.5">
                          <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="flex items-center gap-2">
                            <TradeIcon industry={client.industry_type} />
                            <span className="truncate font-medium text-zinc-950">{client.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 tabular-nums text-zinc-600">{count?.bookings ?? client.bookings_count ?? 0}</td>
                        <td className="px-2 tabular-nums text-zinc-600">{count?.calls ?? 0}</td>
                        <td className="px-2 tabular-nums text-zinc-600">{count?.messages ?? client.usage?.messages_used ?? 0}</td>
                        <td>
                          <StatusBadge status={client.account_status} />
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
          {!demo && topClients.length === 0 ? <p className="py-6 text-sm text-zinc-500">No clients yet.</p> : null}
        </section>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <section className={`${dashCardClass} flex h-full flex-col p-5`}>
          <PanelHead title="Recent client sign-ups" href="/admin/clients" />
          <ul className="divide-y divide-zinc-100">
            {demo
              ? agencyDemo.signups.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <TradeIcon industry={row.industry} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-950">{row.name}</span>
                      <span className="block text-xs text-zinc-500">{row.joined}</span>
                    </span>
                    <Badge color={row.status === 'Active' ? 'green' : 'amber'}>{row.status}</Badge>
                  </li>
                ))
              : signups.map((client) => (
                  <li key={client.id}>
                    <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="flex items-center gap-3 py-3">
                      <TradeIcon industry={client.industry_type} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-950">{client.name}</span>
                        <span className="block text-xs text-zinc-500">Joined {formatDate(client.created_at)}</span>
                      </span>
                      <StatusBadge status={client.account_status} />
                    </Link>
                  </li>
                ))}
          </ul>
        </section>

        <section className={`${dashCardClass} flex h-full flex-col p-5`}>
          <PanelHead title="Needs attention" href="/admin/clients" count={demo ? agencyDemo.attentionCount : attention.length + (alertsQuery.data?.length ?? 0)} />
          <ul className="divide-y divide-zinc-100">
            {demo
              ? agencyDemo.attention.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 py-3">
                    <ExclamationTriangleIcon className={row.tone === 'red' ? 'mt-0.5 size-5 text-red-500' : 'mt-0.5 size-5 text-amber-500'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-950">{row.name}</span>
                      <span className="block text-xs text-zinc-500">{row.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{row.when}</span>
                  </li>
                ))
              : (
                  <>
                    {(alertsQuery.data ?? []).map((alert) => (
                      <li key={`${alert.tenant_id}:${alert.rule_key}`}>
                        <Link href={`/admin/clients/${encodeURIComponent(alert.tenant_id)}`} className="flex items-start gap-3 py-3">
                          <ExclamationTriangleIcon className={alert.severity === 'red' ? 'mt-0.5 size-5 text-red-500' : 'mt-0.5 size-5 text-amber-500'} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-950">{alert.tenant_name}</span>
                            <span className="block text-xs text-zinc-500">{alert.reason}</span>
                          </span>
                          <span className="shrink-0 text-xs text-zinc-400">{timeAgo(alert.since)}</span>
                        </Link>
                      </li>
                    ))}
                    {attention.map(({ client, reason }) => (
                      <li key={`${client.id}:${reason}`}>
                        <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="flex items-start gap-3 py-3">
                          <ExclamationTriangleIcon className="mt-0.5 size-5 text-amber-500" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-950">{client.name}</span>
                            <span className="block text-xs text-zinc-500">{reason}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </>
                )}
          </ul>
          {!demo && attention.length === 0 && (alertsQuery.data?.length ?? 0) === 0 ? (
            <p className="py-4 text-sm text-zinc-500">Nothing is waiting.</p>
          ) : null}
        </section>

        <section className={`${dashCardClass} flex h-full flex-col p-5`}>
          <PanelHead title="Recent activity" href="/admin/activity" />
          <ul>
            {demo
              ? agencyDemo.activity.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 py-2.5">
                    <ActivityDot tone={row.tone} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-950">{row.title}</span>
                      {row.detail ? <span className="block text-xs text-zinc-500">{row.detail}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{row.when}</span>
                  </li>
                ))
              : (activityQuery.data?.recent ?? []).map((event) => <RealActivity key={`${event.kind}-${event.at}-${event.tenant_id}`} event={event} />)}
          </ul>
          {!demo && (activityQuery.data?.recent.length ?? 0) === 0 ? <p className="py-4 text-sm text-zinc-500">No activity yet.</p> : null}
        </section>
      </div>

      {tenantId && !isAgencyStaff ? (
        <InviteCompanyDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          title="Invite a client"
          description="They get their own login. You manage their setup from Clients."
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

function PanelHead({ title, href, count }: { title: string; href: string; count?: number }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        {title}
        {count ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
            {count}
          </span>
        ) : null}
      </h2>
      <Link href={href} className="text-sm font-medium text-blue-600 hover:text-blue-700">
        View all
      </Link>
    </div>
  )
}

function TradeIcon({ industry }: { industry?: string | null }) {
  const key = (industry || '').toLowerCase()
  if (key.includes('hvac') || key.includes('heat')) return <Mark className="bg-sky-50 text-sky-500"><Snowflake /></Mark>
  if (key.includes('roof')) return <Mark className="bg-orange-50 text-orange-500"><HomeRoof /></Mark>
  if (key.includes('plumb')) return <Mark className="bg-cyan-50 text-cyan-500"><Drop /></Mark>
  if (key.includes('elect')) return <Mark className="bg-amber-50 text-amber-500"><BoltIcon className="size-4" /></Mark>
  return <Mark className="bg-zinc-100 text-zinc-500"><BuildingOffice2Icon className="size-4" /></Mark>
}

function Mark({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${className}`}>{children}</span>
}

function Snowflake() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
      <path d="M10 1.5a.75.75 0 0 1 .75.75V4.2l1.4-1.4a.75.75 0 1 1 1.06 1.06L11.8 5.26 13.2 6.7a.75.75 0 1 1-1.06 1.06L10.75 6.36v2.1h2.1l1.4-1.4a.75.75 0 1 1 1.06 1.06L13.9 9.5h1.85a.75.75 0 0 1 0 1.5H13.9l1.4 1.4a.75.75 0 1 1-1.06 1.06l-1.4-1.4h-2.09v2.1l1.39 1.39a.75.75 0 1 1-1.06 1.06L10.75 15.2v1.55a.75.75 0 0 1-1.5 0V15.2l-1.4 1.4a.75.75 0 1 1-1.06-1.06l1.4-1.4v-2.09H6.1l-1.4 1.4a.75.75 0 1 1-1.06-1.06l1.4-1.4H3.25a.75.75 0 0 1 0-1.5H4.99L3.6 8.12a.75.75 0 1 1 1.06-1.06l1.4 1.4h2.19V6.36L6.86 4.97A.75.75 0 1 1 7.92 3.9l1.33 1.34V2.25A.75.75 0 0 1 10 1.5Z" />
    </svg>
  )
}

function HomeRoof() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
      <path d="M10.3 2.3a.75.75 0 0 0-.6 0l-7 3.2a.75.75 0 0 0 .4 1.42l.4-.18V16.5A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5V6.74l.4.18a.75.75 0 1 0 .4-1.42l-7-3.2Z" />
    </svg>
  )
}

function Drop() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
      <path d="M10 2s5 5.2 5 9.2A5 5 0 0 1 5 11.2C5 7.2 10 2 10 2Z" />
    </svg>
  )
}

function ActivityDot({ tone }: { tone: 'green' | 'blue' | 'violet' }) {
  const Icon = tone === 'green' ? CheckCircleIcon : tone === 'violet' ? ChatBubbleLeftRightIcon : CalendarDaysIcon
  const color = tone === 'green' ? 'bg-emerald-50 text-emerald-600' : tone === 'violet' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'
  return (
    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${color}`}>
      <Icon className="size-3.5" />
    </span>
  )
}

function RealActivity({ event }: { event: AgencyActivityEvent }) {
  const tone = event.kind === 'booking' ? 'blue' : event.kind === 'credits' ? 'violet' : 'green'
  return (
    <li>
      <Link href={`/admin/clients/${encodeURIComponent(event.tenant_id)}`} className="flex items-start gap-3 py-2.5">
        <ActivityDot tone={tone} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-950">{event.title}</span>
          <span className="block truncate text-xs text-zinc-500">{event.tenant_name}</span>
        </span>
        <span className="shrink-0 text-xs text-zinc-400">{timeAgo(event.at)}</span>
      </Link>
    </li>
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
              ? 'rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white'
              : 'rounded-full px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200'
          }
        >
          Last {option} days
        </button>
      ))}
    </div>
  )
}

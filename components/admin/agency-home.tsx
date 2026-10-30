'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import {
  ArrowUpIcon,
  BanknotesIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  PlusIcon,
  XMarkIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/16/solid'

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

import { ActivityBars, CollapseControl } from '@/components/activity-bars'
import { attentionReason } from '@/components/admin/agency-dashboard'
import { AgencyNotificationBell } from '@/components/admin/agency-notification-bell'
import { InviteCompanyDialog } from '@/components/admin/invite-company-dialog'
import { StatusBadge, formatDate } from '@/components/admin/shared'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { agencyDemo, agencyDemoSeries, useAgencyDemo } from '@/lib/agency-dashboard-demo'
import { useApiData, useIsAdmin } from '@/lib/hooks'
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

function smoothLine(points: { x: number; y: number }[]) {
  if (points.length === 0) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]
    const current = points[index]
    const next = points[index + 1]
    const after = points[index + 2] ?? next
    const control1x = current.x + (next.x - previous.x) / 6
    const control1y = current.y + (next.y - previous.y) / 6
    const control2x = next.x - (after.x - current.x) / 6
    const control2y = next.y - (after.y - current.y) / 6
    path += ` C ${control1x} ${control1y}, ${control2x} ${control2y}, ${next.x} ${next.y}`
  }
  return path
}

function Sparkline({ values, color, compact = false }: { values: number[]; color: string; compact?: boolean }) {
  const width = 160
  const height = 64
  const gradientId = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const coords = values.map((value, index) => ({
    x: index * step,
    y: height - 8 - ((value - min) / span) * (height - 18),
  }))
  const line = smoothLine(coords)
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={compact ? 'h-8 w-24' : 'h-16 w-[58%] max-w-[11rem]'} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="70%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
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

function runningCount(createdAt: Array<string | null | undefined>, days: string[]) {
  if (days.length < 2) return []
  const stamps = createdAt.map((value) => (value || '').slice(0, 10)).filter(Boolean)
  let count = stamps.filter((day) => day < days[0]).length
  return days.map((day) => {
    count += stamps.filter((stamp) => stamp === day).length
    return count
  })
}

function inRange(iso: string | null | undefined, start: string, end: string) {
  if (!iso) return false
  const day = iso.slice(0, 10)
  return day >= start && day <= end
}

export function AgencyHome() {
  const { user } = useUser()
  const [range, setRange] = useState(defaultRange)
  const [draft, setDraft] = useState(defaultRange)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [chartMin, setChartMin] = useState(false)
  const [clientsMin, setClientsMin] = useState(false)
  const [clientFind, setClientFind] = useState('')
  const [clientPage, setClientPage] = useState(1)
  const [signupFind, setSignupFind] = useState('')
  const [signupPage, setSignupPage] = useState(1)
  const [attentionFind, setAttentionFind] = useState('')
  const [attentionPage, setAttentionPage] = useState(1)
  const [activityFind, setActivityFind] = useState('')
  const [activityPage, setActivityPage] = useState(1)
  const welcomeName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.fullName || ''
  const { enabled: demo, setDemo } = useAgencyDemo()
  const { tenantId, isAgencyStaff } = useIsAdmin()
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
  const needle = query.trim().toLowerCase()
  const topClients = [...clients]
    .filter((client) => !needle || client.name.toLowerCase().includes(needle))
    .sort((a, b) => (counts.get(b.id)?.bookings ?? 0) - (counts.get(a.id)?.bookings ?? 0))
  const signups = clients
    .filter((client) => !needle || client.name.toLowerCase().includes(needle))
    .filter((client) => inRange(client.created_at, range.start, range.end))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const attention = clients
    .map((client) => ({ client, reason: attentionReason(client) }))
    .filter((item): item is { client: AdminTenant; reason: string } => item.reason !== null)

  return (
    <PageShell>
      <div className="flex flex-col gap-5">
        <div className="flex w-full flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients, bookings, conversations..."
              className="h-11 w-full rounded-full border border-zinc-200/80 bg-white pr-16 pl-11 text-sm text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-200"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
              ⌘ K
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraft(range)
                setRangeOpen((open) => !open)
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200"
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
          <button
            type="button"
            onClick={() => setDemo(!demo)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-200"
          >
            <span>{demo ? 'Demo data on' : 'Demo data off'}</span>
            <span className={`relative h-5 w-9 rounded-full ${demo ? 'bg-blue-600' : 'bg-zinc-300'}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${demo ? 'left-4' : 'left-0.5'}`} />
            </span>
          </button>
          {isAgencyStaff || !tenantId ? null : (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <PlusIcon className="size-4" />
              Add New Client
            </button>
          )}
          <AgencyNotificationBell circle />
          </div>
        </div>
        <div>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Welcome back
            {welcomeName ? `, ${welcomeName}` : ''} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Here&apos;s an overview of your clients, bookings, and AI performance.
          </p>
        </div>
      </div>

      {clientsQuery.error && !demo ? <p className="text-sm text-red-600">{clientsQuery.error}</p> : null}

      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi, index) => {
          const Icon = icons[index] ?? UsersIcon
          const cardSeries = demo ? agencyDemoSeries() : series
          const tones = [
            'bg-blue-100 text-blue-500',
            'bg-violet-100 text-violet-500',
            'bg-emerald-100 text-emerald-500',
            'bg-orange-100 text-orange-500',
            'bg-rose-100 text-rose-500',
          ]
          const strokes = ['#60a5fa', '#a78bfa', '#34d399', '#fb923c', '#fb7185']
          const demoWaves = [
            [1.2, 1.5, 1.4, 1.8, 2.1, 2, 2.6, 3, 3.4, 4.1, 4.6, 5],
            [6, 9, 8, 12, 11, 16, 14, 20, 18, 24, 26, 30],
            [8, 11, 14, 12, 18, 16, 22, 20, 26, 24, 30, 34],
            [4, 6, 5, 8, 9, 8, 12, 14, 13, 16, 18, 20],
            [3, 5, 4, 7, 6, 9, 8, 12, 11, 14, 16, 18],
          ]
          const spark = demo
            ? demoWaves[index] ?? []
            : index === 0
              ? runningCount(clients.map((client) => client.created_at), cardSeries.map((point) => point.date))
              : index === 1
                ? cardSeries.map((point) => point.bookings)
                : index === 2
                  ? cardSeries.map((point) => point.call_minutes ?? 0)
                  : index === 3
                    ? cardSeries.map((point) => point.messages)
                    : []
          return (
            <article
              key={kpi.label}
              className={`${dashCardClass} relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-[20px] p-4 transition hover:-translate-y-0.5 hover:shadow-md motion-safe:duration-200`}
            >
              <div className="relative z-10 flex items-start gap-3 pr-2">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tones[index] ?? tones[0]}`}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-500">
                    {kpi.label.replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </p>
                  <p className="mt-1 text-[1.65rem] font-semibold leading-none tracking-tight text-zinc-950">{kpi.value}</p>
                  <p className="mt-2 flex min-h-4 items-center gap-1 text-xs font-medium text-emerald-500">
                    {kpi.trend ? (
                      <>
                        <ArrowUpIcon className="size-3" />
                        {kpi.trend}
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="pointer-events-none absolute right-0 bottom-0">
                <Sparkline values={spark} color={strokes[index] ?? strokes[0]} />
              </div>
            </article>
          )
        })}
      </div>

      <div className="@container">
      <div className="flex flex-col items-start gap-4 @min-[720px]:flex-row">
        <div
          className={`min-w-0 overflow-hidden motion-safe:transition-[flex-grow,flex-basis,max-width] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
            chartMin
              ? 'w-full @min-[720px]:max-w-[26rem] @min-[720px]:flex-[0_0_26rem]'
              : 'w-full @min-[720px]:max-w-none @min-[720px]:flex-[3_1_0%]'
          }`}
        >
          <ActivityBars
            variant="premium"
            minimized={chartMin}
            onToggleMinimize={() => setChartMin((value) => !value)}
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

        <section
          className={`${dashCardClass} flex h-full min-w-0 flex-col rounded-[18px] p-5 motion-safe:transition-[flex-grow,flex-basis] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
            chartMin ? '@min-[720px]:flex-[1_1_0%]' : '@min-[720px]:flex-[2_1_0%]'
          }`}
        >
          <PanelHead
            title="Top performing clients"
            href="/admin/clients"
            minimized={clientsMin}
            onToggle={() => setClientsMin((value) => !value)}
          />
          <div
            className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
              clientsMin ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
            }`}
          >
            <div className="overflow-hidden">
          <CardFind
            value={clientFind}
            placeholder="Search clients"
            onChange={(value) => {
              setClientFind(value)
              setClientPage(1)
            }}
          />
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-zinc-400">
              <tr>
                <th className="py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Bookings</th>
                <th className="px-2 py-2 font-medium">Calls</th>
                <th className="px-2 py-2 font-medium">Messages</th>
                {demo ? <th className="px-2 py-2 font-medium">Revenue</th> : null}
                <th className="py-2 font-medium">Status</th>
                {demo ? <th className="py-2 font-medium">Trend</th> : null}
              </tr>
            </thead>
            <tbody>
              {demo
                ? pageSlice(
                    agencyDemo.clients.filter((client) => matches(client.name, needle, clientFind)),
                    clientPage,
                  ).rows.map((client) => (
                    <tr key={client.id} className="border-t border-zinc-100">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <ClientMark name={client.name} image={client.image} />
                          <span className="truncate font-medium text-zinc-950">{client.name}</span>
                        </span>
                      </td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.bookings}</td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.calls}</td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.messages}</td>
                      <td className="px-2 tabular-nums text-zinc-600">{client.revenue}</td>
                      <td>
                        <Badge color={client.status === 'Active' ? 'green' : 'amber'}>{client.status}</Badge>
                      </td>
                      <td className="pl-2">
                        <Sparkline compact values={client.trend} color={client.status === 'Active' ? '#10b981' : '#f59e0b'} />
                      </td>
                    </tr>
                  ))
                : pageSlice(
                    topClients.filter((client) => matches(client.name, '', clientFind)),
                    clientPage,
                  ).rows.map((client) => {
                    const count = counts.get(client.id)
                    return (
                      <tr key={client.id} className="border-t border-zinc-100">
                        <td className="py-2.5">
                          <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="flex items-center gap-2">
                            <ClientMark name={client.name} />
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
          </div>
          <Pager
            {...pageMeta(
              demo
                ? agencyDemo.clients.filter((client) => matches(client.name, needle, clientFind)).length
                : topClients.filter((client) => matches(client.name, '', clientFind)).length,
              clientPage,
            )}
            onChange={setClientPage}
          />
          <EmptyMatch
            query={clientFind}
            count={
              demo
                ? agencyDemo.clients.filter((client) => matches(client.name, needle, clientFind)).length
                : topClients.filter((client) => matches(client.name, '', clientFind)).length
            }
            noun="clients"
          />
            </div>
          </div>
          {!demo && !clientsMin && topClients.length === 0 ? <p className="py-6 text-sm text-zinc-500">No clients yet.</p> : null}
        </section>
      </div>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
          <PanelHead title="Recent client sign-ups" href="/admin/clients" />
          <CardFind
            value={signupFind}
            placeholder="Search sign-ups"
            onChange={(value) => {
              setSignupFind(value)
              setSignupPage(1)
            }}
          />
          <ul className="mt-2 divide-y divide-zinc-100">
            {demo
              ? pageSlice(agencyDemo.signups.filter((row) => matches(row.name, needle, signupFind)), signupPage).rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <ClientMark name={row.name} image={row.image} industry={row.industry} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-950">{row.name}</span>
                      <span className="block text-xs text-zinc-500">{row.joined}</span>
                    </span>
                    <Badge color={row.status === 'Active' ? 'green' : 'amber'}>{row.status}</Badge>
                  </li>
                ))
              : pageSlice(signups.filter((client) => matches(client.name, '', signupFind)), signupPage).rows.map((client) => (
                  <li key={client.id}>
                    <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="flex items-center gap-3 py-3">
                      <ClientMark name={client.name} industry={client.industry_type} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-950">{client.name}</span>
                        <span className="block text-xs text-zinc-500">Joined {formatDate(client.created_at)}</span>
                      </span>
                      <StatusBadge status={client.account_status} />
                    </Link>
                  </li>
                ))}
          </ul>
          <Pager
            {...pageMeta(
              demo
                ? agencyDemo.signups.filter((row) => matches(row.name, needle, signupFind)).length
                : signups.filter((client) => matches(client.name, '', signupFind)).length,
              signupPage,
            )}
            onChange={setSignupPage}
          />
          <EmptyMatch
            query={signupFind}
            count={
              demo
                ? agencyDemo.signups.filter((row) => matches(row.name, needle, signupFind)).length
                : signups.filter((client) => matches(client.name, '', signupFind)).length
            }
            noun="sign-ups"
          />
        </section>

        <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
          <PanelHead title="Needs attention" href="/admin/clients" count={demo ? agencyDemo.attention.filter((row) => matches(`${row.name} ${row.detail}`, '', attentionFind)).length : attention.length + (alertsQuery.data?.length ?? 0)} />
          <CardFind
            value={attentionFind}
            placeholder="Search alerts"
            onChange={(value) => {
              setAttentionFind(value)
              setAttentionPage(1)
            }}
          />
          <ul className="mt-2 divide-y divide-zinc-100">
            {demo
              ? pageSlice(agencyDemo.attention.filter((row) => matches(`${row.name} ${row.detail}`, '', attentionFind)), attentionPage).rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 py-3">
                    {row.image ? <ClientMark name={row.name} image={row.image} /> : <ExclamationTriangleIcon className={row.tone === 'red' ? 'mt-0.5 size-5 shrink-0 text-red-500' : 'mt-0.5 size-5 shrink-0 text-amber-500'} />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-950">{row.name}</span>
                      <span className="block text-xs text-zinc-500">{row.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{row.when}</span>
                  </li>
                ))
              : pageSlice(
                  [
                    ...(alertsQuery.data ?? []).filter((alert) => matches(`${alert.tenant_name} ${alert.reason}`, '', attentionFind)).map((alert) => ({ kind: 'alert' as const, alert })),
                    ...attention.filter(({ client, reason }) => matches(`${client.name} ${reason}`, '', attentionFind)).map((item) => ({ kind: 'note' as const, item })),
                  ],
                  attentionPage,
                ).rows.map((row) => row.kind === 'alert' ? (
                  <li key={`${row.alert.tenant_id}:${row.alert.rule_key}`}>
                    <Link href={`/admin/clients/${encodeURIComponent(row.alert.tenant_id)}`} className="flex items-start gap-3 py-3">
                      <ExclamationTriangleIcon className={row.alert.severity === 'red' ? 'mt-0.5 size-5 text-red-500' : 'mt-0.5 size-5 text-amber-500'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-950">{row.alert.tenant_name}</span>
                        <span className="block text-xs text-zinc-500">{row.alert.reason}</span>
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">{timeAgo(row.alert.since)}</span>
                    </Link>
                  </li>
                ) : (
                  <li key={`${row.item.client.id}:${row.item.reason}`}>
                    <Link href={`/admin/clients/${encodeURIComponent(row.item.client.id)}`} className="flex items-start gap-3 py-3">
                      <ExclamationTriangleIcon className="mt-0.5 size-5 text-amber-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-950">{row.item.client.name}</span>
                        <span className="block text-xs text-zinc-500">{row.item.reason}</span>
                      </span>
                    </Link>
                  </li>
                ))}
          </ul>
          <Pager
            {...pageMeta(
              demo
                ? agencyDemo.attention.filter((row) => matches(`${row.name} ${row.detail}`, '', attentionFind)).length
                : (alertsQuery.data ?? []).filter((alert) => matches(`${alert.tenant_name} ${alert.reason}`, '', attentionFind)).length
                  + attention.filter(({ client, reason }) => matches(`${client.name} ${reason}`, '', attentionFind)).length,
              attentionPage,
            )}
            onChange={setAttentionPage}
          />
          <EmptyMatch
            query={attentionFind}
            count={
              demo
                ? agencyDemo.attention.filter((row) => matches(`${row.name} ${row.detail}`, '', attentionFind)).length
                : (alertsQuery.data ?? []).filter((alert) => matches(`${alert.tenant_name} ${alert.reason}`, '', attentionFind)).length
                  + attention.filter(({ client, reason }) => matches(`${client.name} ${reason}`, '', attentionFind)).length
            }
            noun="alerts"
          />
          {!demo && attention.length === 0 && (alertsQuery.data?.length ?? 0) === 0 ? (
            <p className="py-4 text-sm text-zinc-500">Nothing is waiting.</p>
          ) : null}
        </section>

        <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
          <PanelHead title="Recent activity" href="/admin/activity" />
          <CardFind
            value={activityFind}
            placeholder="Search activity"
            onChange={(value) => {
              setActivityFind(value)
              setActivityPage(1)
            }}
          />
          <ul className="mt-2">
            {demo
              ? pageSlice(agencyDemo.activity.filter((row) => matches(`${row.title} ${row.detail}`, '', activityFind)), activityPage).rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 py-2.5">
                    <ActivityDot tone={row.tone} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-950">{row.title}</span>
                      {row.detail ? <span className="block text-xs text-zinc-500">{row.detail}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{row.when}</span>
                  </li>
                ))
              : pageSlice((activityQuery.data?.recent ?? []).filter((event) => matches(`${event.title} ${event.tenant_name}`, '', activityFind)), activityPage).rows.map((event) => <RealActivity key={`${event.kind}-${event.at}-${event.tenant_id}`} event={event} />)}
          </ul>
          <Pager
            {...pageMeta(
              demo
                ? agencyDemo.activity.filter((row) => matches(`${row.title} ${row.detail}`, '', activityFind)).length
                : (activityQuery.data?.recent ?? []).filter((event) => matches(`${event.title} ${event.tenant_name}`, '', activityFind)).length,
              activityPage,
            )}
            onChange={setActivityPage}
          />
          <EmptyMatch
            query={activityFind}
            count={
              demo
                ? agencyDemo.activity.filter((row) => matches(`${row.title} ${row.detail}`, '', activityFind)).length
                : (activityQuery.data?.recent ?? []).filter((event) => matches(`${event.title} ${event.tenant_name}`, '', activityFind)).length
            }
            noun="activity"
          />
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

const PAGE_SIZE = 5

function matches(text: string, header: string, card: string) {
  const value = text.toLowerCase()
  return (!header.trim() || value.includes(header.trim().toLowerCase())) && (!card.trim() || value.includes(card.trim().toLowerCase()))
}

function pageSlice<T>(items: T[], page: number) {
  const meta = pageMeta(items.length, page)
  return {
    rows: items.slice((meta.current - 1) * PAGE_SIZE, meta.current * PAGE_SIZE),
    ...meta,
  }
}

function EmptyMatch({ query, count, noun }: { query: string; count: number; noun: string }) {
  if (!query.trim() || count > 0) return null
  return <p className="py-6 text-center text-sm text-zinc-400">No {noun} match “{query.trim()}”.</p>
}

function pageMeta(count: number, page: number) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const current = Math.min(Math.max(page, 1), pages)
  return { current, pages, total: count }
}

function CardFind({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="group relative mt-3 block">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400 transition group-focus-within:text-blue-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-2xl bg-zinc-50/90 pr-9 pl-10 text-[13px] text-zinc-800 shadow-[inset_0_0_0_1px_rgba(228,228,231,0.95)] outline-none transition placeholder:text-zinc-400 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.45),0_0_0_4px_rgba(37,99,235,0.10)]"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-200/70 hover:text-zinc-700"
        >
          <XMarkIcon className="size-3.5" />
        </button>
      ) : null}
    </label>
  )
}

function Pager({ current, pages, total, onChange }: { current: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null
  const start = (current - 1) * PAGE_SIZE + 1
  const end = Math.min(current * PAGE_SIZE, total)
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
      <p className="text-xs text-zinc-400">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-0.5 rounded-full bg-zinc-50 p-0.5 ring-1 ring-zinc-200/80">
        <button
          type="button"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
          className="inline-flex size-7 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white hover:text-blue-600 disabled:opacity-35"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="min-w-10 text-center text-xs font-medium text-zinc-600">
          {current}/{pages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
          className="inline-flex size-7 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white hover:text-blue-600 disabled:opacity-35"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}

function ClientMark({ name, image, industry }: { name: string; image?: string | null; industry?: string | null }) {
  const [failed, setFailed] = useState(false)
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200" onError={() => setFailed(true)} />
    )
  }
  if (industry) return <TradeIcon industry={industry} />
  return (
    <span title={name} className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
      <BuildingOffice2Icon className="size-4" />
    </span>
  )
}

function PanelHead({
  title,
  href,
  count,
  minimized,
  onToggle,
}: {
  title: string
  href: string
  count?: number
  minimized?: boolean
  onToggle?: () => void
}) {
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
      <span className="flex items-center gap-2">
        <Link href={href} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          View all
        </Link>
        {onToggle ? <CollapseControl minimized={!!minimized} label={title} onClick={onToggle} /> : null}
      </span>
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

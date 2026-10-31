'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useAuth, useOrganization } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import clsx from 'clsx'
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { ActivityBars, CollapseControl } from '@/components/activity-bars'
import { ChannelIcon } from '@/components/channel-icon'
import { Button } from '@/components/button'
import { PageShell, dashCardClass } from '@/components/dashboard-ui'
import { KpiStatCard } from '@/components/kpi-stat-card'
import { Input } from '@/components/input'
import { Badge } from '@/components/badge'
import { SourceBadge } from '@/components/channel-icon'
import { NotificationBell } from '@/components/notification-bell'
import { useApiData, useTenantTimezone } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDateTime, statusColor } from '@/lib/utils'
import {
  decodeReportRange,
  encodeReportRange,
  formatRangeLabel,
  rangeDayCount,
  shiftDateKey,
} from '@/lib/report-range'
import type { TenantStats, Booking, ChannelAccount } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calendar date key (YYYY-MM-DD) in the tenant timezone. */
function dayKeyInTz(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

function percentChange(current: number, previous: number | null | undefined) {
  if (previous == null) return null
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
  stroke,
  series,
  delta,
}: {
  label: string
  value: number | string
  hint?: string
  icon: React.ReactNode
  tone: string
  stroke: string
  series?: number[]
  delta?: number | null
}) {
  const trendTone = delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  const trend = delta == null ? hint : delta === 0 ? 'No change' : `${Math.abs(delta)}% from last month`
  return (
    <KpiStatCard
      label={label}
      value={value}
      trend={trend}
      trendTone={trendTone}
      icon={icon}
      tone={tone}
      stroke={stroke}
      series={series ?? []}
    />
  )
}

// ---------------------------------------------------------------------------
// Weekly bar chart (dependency-free)
// ---------------------------------------------------------------------------

type ChartWindow = 'week' | 'month' | 'year' | 'custom' | 'all'

function chartCaption(kind: ChartWindow) {
  if (kind === 'month') return 'last 30 days'
  if (kind === 'custom') return 'selected range'
  if (kind === 'all') return 'all time'
  return 'last 7 days'
}

function chartChipLabel(kind: ChartWindow, custom?: string) {
  if (kind === 'month') return 'Last 30 days'
  if (kind === 'custom') return custom || 'Custom range'
  if (kind === 'all') return 'All time'
  return 'Last 7 days'
}

function activityPoints(stats: TenantStats | null) {
  const byDate = new Map<string, { bookings: number; calls: number; messages: number }>()
  const add = (
    rows: { date: string; count: number }[] | undefined,
    key: 'bookings' | 'calls' | 'messages',
  ) => {
    for (const row of rows ?? []) {
      const current = byDate.get(row.date) ?? { bookings: 0, calls: 0, messages: 0 }
      current[key] = row.count
      byDate.set(row.date, current)
    }
  }
  add(stats?.daily, 'bookings')
  add(stats?.call_daily, 'calls')
  add(stats?.message_daily, 'messages')
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, counts]) => ({ date, ...counts }))
}

// ---------------------------------------------------------------------------
// Completion gauge (SVG)
// ---------------------------------------------------------------------------

function CompletionGauge({
  stats,
  loading,
}: {
  stats: TenantStats | null
  loading: boolean
}) {
  const total = stats?.total_bookings ?? 0
  const completed = stats?.completed_bookings ?? 0
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Half-circle gauge geometry
  const radius = 70
  const circumference = Math.PI * radius // half circle
  const dash = (pct / 100) * circumference

  return (
    <section className={`${dashCardClass} flex h-full min-h-full flex-col rounded-[18px] p-5`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Completion rate</h2>

        {loading ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <>
            <div className="relative mx-auto mt-4 w-full max-w-50">
              <svg viewBox="0 0 180 100" className="w-full">
                <path
                  d="M 20 90 A 70 70 0 0 1 160 90"
                  fill="none"
                  className="stroke-zinc-100 dark:stroke-zinc-800"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M 20 90 A 70 70 0 0 1 160 90"
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference}`}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-x-0 bottom-1 text-center">
                <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                  {pct}%
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">completed</p>
              </div>
            </div>

            <div className="mt-auto space-y-2 pt-4">
              <GaugeLegend color="bg-emerald-500" label="Completed" value={completed} />
              <GaugeLegend
                color="bg-blue-500"
                label="Upcoming"
                value={stats?.upcoming_bookings ?? 0}
              />
              <GaugeLegend
                color="bg-zinc-300 dark:bg-zinc-600"
                label="Cancelled"
                value={stats?.cancelled_bookings ?? 0}
              />
            </div>
          </>
        )}
    </section>
  )
}

function GaugeLegend({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <span className={clsx('size-2.5 rounded-full', color)} />
        {label}
      </span>
      <span className="font-medium text-zinc-700 dark:text-zinc-200">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Booking list + connected accounts
// ---------------------------------------------------------------------------

type BookingFilter = 'all' | 'confirmed' | 'completed' | 'cancelled'

const BOOKING_FILTERS: { id: BookingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_TINTS = [
  'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
]

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span
      className={clsx(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        AVATAR_TINTS[index % AVATAR_TINTS.length],
      )}
    >
      {initials(name)}
    </span>
  )
}

function BookingListCard({
  bookings,
  tz,
  loading,
  pageFind,
  minimized,
  onToggle,
}: {
  bookings: Booking[] | null
  tz: string
  loading: boolean
  pageFind: string
  minimized: boolean
  onToggle: () => void
}) {
  const [find, setFind] = useState('')
  const [status, setStatus] = useState<BookingFilter>('all')
  const needle = `${pageFind} ${find}`.trim().toLowerCase()
  const items = (bookings ?? []).filter((booking) => {
    if (status !== 'all' && booking.status !== status) return false
    if (!needle) return true
    return `${booking.customer_name ?? ''} ${booking.service_type ?? ''} ${booking.status}`.toLowerCase().includes(needle)
  })
  const filterLabel = BOOKING_FILTERS.find((item) => item.id === status)?.label ?? 'All'

  return (
    <section className={`${dashCardClass} flex h-full min-h-0 min-w-0 flex-col rounded-[18px] p-5`}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="truncate text-base font-semibold text-zinc-950 dark:text-white">Bookings</h2>
        <span className="flex shrink-0 items-center gap-2">
          <Menu as="div" className="relative shrink-0">
            <MenuButton className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
              {filterLabel}
              <ChevronDownIcon className="size-3.5 text-zinc-400" />
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              className="z-20 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200 [--anchor-gap:6px] focus:outline-none dark:bg-zinc-900 dark:ring-zinc-700"
            >
              {BOOKING_FILTERS.map((item) => (
                <MenuItem key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStatus(item.id)}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
                  >
                    {item.label}
                  </button>
                </MenuItem>
              ))}
            </MenuItems>
          </Menu>
          <Link href="/bookings" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            View all
          </Link>
          <CollapseControl minimized={minimized} label="Bookings" onClick={onToggle} />
        </span>
      </div>
      <div
        className={`grid min-h-0 motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
          minimized ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="flex min-h-0 flex-col overflow-hidden">
          <label className="group relative mt-2.5 block">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400 transition group-focus-within:text-blue-500" />
            <input
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="Search bookings"
              className="h-8 w-full rounded-lg bg-zinc-100/60 pr-7 pl-8 text-[13px] text-zinc-700 outline-none transition placeholder:text-zinc-400 focus:bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-200"
            />
            {find ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setFind('')}
                className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white hover:text-zinc-700"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            ) : null}
          </label>
          {loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : items.length > 0 ? (
            <ul className="scroll-hide mt-3 max-h-[16.25rem] divide-y divide-zinc-950/5 overflow-y-auto overscroll-contain dark:divide-white/5">
              {items.map((booking, index) => (
                <li key={booking.id}>
                  <Link
                    href="/bookings"
                    className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <Avatar name={booking.customer_name || 'Customer'} index={index} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                        {booking.customer_name || 'Customer'}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {booking.service_type || 'Appointment'} ·{' '}
                        {booking.selected_slot ? formatDateTime(booking.selected_slot, tz) : '—'}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <SourceBadge channel={booking.source_channel} />
                    </div>
                    <Badge color={statusColor(booking.status)} className="shrink-0 capitalize">
                      {booking.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CalendarDaysIcon className="size-7" />
              </span>
              <p className="mt-4 text-sm font-medium text-zinc-950 dark:text-white">No bookings in this view</p>
              <p className="mt-1 text-sm text-zinc-500">Try another status, or clear the search.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function pickChannel(rows: ChannelAccount[] | null | undefined, channel: 'facebook' | 'instagram') {
  const matches = (rows ?? []).filter((row) => row.channel === channel)
  return (
    matches.find((row) => row.connection_status === 'verified' && row.is_active) ??
    matches.find((row) => row.is_active) ??
    matches[0] ??
    null
  )
}

function channelStatus(account: ChannelAccount | null) {
  if (!account) return { label: 'Not connected', className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300' }
  if (account.connection_status === 'verified') {
    return { label: 'Connected', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' }
  }
  if (account.connection_status === 'error') {
    return { label: 'Needs attention', className: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' }
  }
  return { label: 'Pending', className: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' }
}

function SocialAccountCard({
  channel,
  account,
}: {
  channel: 'facebook' | 'instagram'
  account: ChannelAccount | null
}) {
  const title = channel === 'facebook' ? 'Facebook' : 'Instagram'
  const status = channelStatus(account)
  const connected = Boolean(account)
  return (
    <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={clsx(
              'flex size-10 shrink-0 items-center justify-center rounded-full ring-1',
              connected ? 'bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700' : 'bg-zinc-50 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700',
            )}
          >
            <ChannelIcon channel={channel} className="size-6" colored />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h2>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {connected ? account?.label || 'Connected account' : 'Not linked yet'}
            </p>
          </div>
        </div>
        <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>
          {status.label}
        </span>
      </div>
      {connected && account ? (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {account.connection_message ||
              (account.connection_status === 'verified'
                ? 'Messages from this account can create bookings.'
                : 'Finish setup on the accounts page.')}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            {account.is_active ? 'Active' : 'Inactive'}
            {account.last_verified_at ? ` · checked ${formatDateTime(account.last_verified_at)}` : ''}
          </p>
          <div className="mt-auto pt-4">
            <Link href="/accounts" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Manage
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {channel === 'facebook' ? 'Connect Facebook Messenger' : 'Connect Instagram'}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {channel === 'facebook'
                ? 'Page messages show up here once the account is connected.'
                : 'Instagram messages show up here once the account is connected.'}
            </p>
          </div>
          <div className="mt-auto pt-4">
            <Button href="/accounts" color="brand">
              Connect
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardPageInner() {
  const { organization } = useOrganization()
  const { orgId } = useAuth()
  const router = useRouter()
  const search = useSearchParams()
  const tenantTz = useTenantTimezone()
  const linkToken = search.get('r')
  const decoded = useMemo(
    () => (linkToken ? decodeReportRange(linkToken) : null),
    [linkToken],
  )
  const pendingLink = Boolean(linkToken) && !orgId
  const linkIgnored = Boolean(
    decoded?.tenantId && orgId && decoded.tenantId !== orgId,
  )
  const range =
    decoded && orgId && !linkIgnored && rangeDayCount(decoded.start, decoded.end) <= 61
      ? { start: decoded.start, end: decoded.end }
      : null
  const today = dayKeyInTz(new Date(), tenantTz)
  const last7 = { start: shiftDateKey(today, -6), end: today }
  const last30 = { start: shiftDateKey(today, -29), end: today }

  const { data: stats, loading: statsLoading } = useApiData<TenantStats>(
    (token) => {
      if (pendingLink) return Promise.resolve(null as unknown as TenantStats)
      return api.tenants.stats(token, range ?? undefined)
    },
    [pendingLink, range?.start ?? '', range?.end ?? ''],
  )
  const statsView = pendingLink ? null : stats
  const statsBusy = statsLoading || pendingLink

  const [draftStart, setDraftStart] = useState(range?.start ?? '')
  const [draftEnd, setDraftEnd] = useState(range?.end ?? '')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [pageFind, setPageFind] = useState('')
  const [chartMin, setChartMin] = useState(false)
  const [listMin, setListMin] = useState(false)
  useEffect(() => {
    setDraftStart(range?.start ?? '')
    setDraftEnd(range?.end ?? '')
  }, [range?.start, range?.end])

  function openRange(start: string, end: string) {
    if (!orgId || !start || !end) return false
    const next = start <= end ? { start, end } : { start: end, end: start }
    if (rangeDayCount(next.start, next.end) > 61) {
      toast.error('Choose a range of two months or less.')
      return false
    }
    const token = encodeReportRange(next.start, next.end, orgId)
    router.replace(`/?r=${encodeURIComponent(token)}`)
    return true
  }

  const bookingsQuery = useApiData<Booking[]>(
    (token) => (pendingLink ? Promise.resolve([] as Booking[]) : api.bookings.list(token, { limit: 100 })),
    [pendingLink],
  )
  const channelsQuery = useApiData<ChannelAccount[]>(
    (token) => (pendingLink ? Promise.resolve([] as ChannelAccount[]) : api.channels.list(token)),
    [pendingLink],
  )
  const chartStats = statsView
  const chartBusy = statsBusy

  const businessName = organization?.name || 'Dashboard'

  const windowKind: ChartWindow = !range
    ? 'all'
    : range.start === last7.start && range.end === last7.end
      ? 'week'
      : range.start === last30.start && range.end === last30.end
        ? 'month'
        : 'custom'

  function formatRangeWithYear(start: string, end: string) {
    const fmt = (iso: string) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    return `${fmt(start)} – ${fmt(end)}`
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-5">
        <div className="flex w-full flex-wrap items-center gap-3">
          <label className="relative w-full max-w-[50%]">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={pageFind}
              onChange={(event) => setPageFind(event.target.value)}
              placeholder="Search bookings, conversations..."
              className="h-11 w-full rounded-full border border-zinc-200/80 bg-white pr-16 pl-11 text-sm text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-200"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
              ⌘ K
            </span>
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraftStart(range?.start ?? '')
                setDraftEnd(range?.end ?? '')
                setRangeOpen((open) => !open)
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200"
            >
              <CalendarDaysIcon className="size-4 shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">{range ? formatRangeWithYear(range.start, range.end) : 'All time'}</span>
              <ChevronDownIcon className="size-4 shrink-0 text-zinc-400" />
            </button>
            {rangeOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl bg-white p-3 shadow-lg ring-1 ring-zinc-200">
                <label className="block text-xs font-medium text-zinc-500">
                  Start date
                  <Input
                    type="date"
                    className="mt-1"
                    value={draftStart}
                    onChange={(event) => setDraftStart(event.target.value)}
                  />
                </label>
                <label className="mt-2 block text-xs font-medium text-zinc-500">
                  End date
                  <Input
                    type="date"
                    className="mt-1"
                    value={draftEnd}
                    onChange={(event) => setDraftEnd(event.target.value)}
                  />
                </label>
                <p className="mt-2 text-[11px] text-zinc-400">Up to two months.</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    color="brand"
                    className="flex-1"
                    onClick={() => {
                      if (openRange(draftStart, draftEnd)) setRangeOpen(false)
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    outline
                    onClick={() => {
                      router.replace('/')
                      setRangeOpen(false)
                    }}
                  >
                    All time
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <Link href="/conversations" className="inline-flex h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200">
            Conversations
          </Link>
          <Link href="/bookings" className="inline-flex h-11 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            View bookings
          </Link>
          <NotificationBell circle />
          </div>
        </div>
        <div>
          <h1 className="truncate text-[1.7rem] font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Welcome back, {businessName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Here is your booking activity at a glance.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsBusy ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))
        ) : (
          <>
            <KpiCard
              label="Total bookings"
              value={statsView?.total_bookings ?? 0}
              hint={`${statsView?.confirmed_bookings ?? 0} confirmed`}
              icon={<CalendarDaysIcon className="size-5" />}
              tone="bg-blue-100 text-blue-500"
              stroke="#60a5fa"
              series={statsView?.daily?.map((point) => point.count)}
              delta={percentChange(statsView?.total_bookings ?? 0, statsView?.previous_total_bookings)}
            />
            <KpiCard
              label="Completed"
              value={statsView?.completed_bookings ?? 0}
              hint={`${statsView?.cancelled_bookings ?? 0} cancelled`}
              icon={<CheckCircleIcon className="size-5" />}
              tone="bg-emerald-100 text-emerald-500"
              stroke="#34d399"
              series={statsView?.completed_daily?.map((point) => point.count)}
              delta={percentChange(statsView?.completed_bookings ?? 0, statsView?.previous_completed_bookings)}
            />
            <KpiCard
              label="Upcoming"
              value={statsView?.upcoming_bookings ?? 0}
              hint="Scheduled ahead"
              icon={<ClockIcon className="size-5" />}
              tone="bg-violet-100 text-violet-500"
              stroke="#a78bfa"
              series={statsView?.upcoming_daily?.map((point) => point.count)}
              delta={percentChange(statsView?.upcoming_bookings ?? 0, statsView?.previous_upcoming_bookings)}
            />
            <KpiCard
              label="Active conversations"
              value={statsView?.active_conversations ?? 0}
              hint={
                range
                  ? 'Started in this range'
                  : `${statsView?.total_channel_accounts ?? 0} channels`
              }
              icon={<ChatBubbleLeftRightIcon className="size-5" />}
              tone="bg-orange-100 text-orange-500"
              stroke="#fb923c"
              series={statsView?.conversation_daily?.map((point) => point.count)}
              delta={percentChange(statsView?.active_conversations ?? 0, statsView?.previous_active_conversations)}
            />
          </>
        )}
      </div>

      <div className="@container">
        <div
          className={
            chartMin
              ? 'flex flex-col items-start gap-4 @min-[720px]:flex-row'
              : 'grid items-stretch gap-4 @min-[720px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'
          }
        >
          <div className={chartMin ? 'w-full @min-[720px]:max-w-[26rem] @min-[720px]:flex-[0_0_26rem]' : 'flex h-full min-h-0 flex-col'}>
            <ActivityBars
              variant="premium"
              minimized={chartMin}
              onToggleMinimize={() => setChartMin((value) => !value)}
              title="Booking activity"
              subtitle={`New bookings · ${chartCaption(windowKind)}`}
              points={activityPoints(chartStats)}
              loading={chartBusy}
              menu={
                <Menu as="div" className="relative shrink-0">
                  <MenuButton className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
                    {chartChipLabel(windowKind, range ? formatRangeLabel(range.start, range.end) : undefined)}
                    <ChevronDownIcon className="size-3.5 text-zinc-400" />
                  </MenuButton>
                  <MenuItems
                    anchor="bottom end"
                    className="z-20 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200 [--anchor-gap:6px] focus:outline-none dark:bg-zinc-900 dark:ring-zinc-700"
                  >
                    <MenuItem>
                      <button
                        type="button"
                        onClick={() => openRange(last7.start, last7.end)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
                      >
                        Last 7 days
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        type="button"
                        onClick={() => openRange(last30.start, last30.end)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
                      >
                        Last 30 days
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        type="button"
                        onClick={() => router.replace('/')}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
                      >
                        All time
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              }
            />
          </div>
          <div className={chartMin ? 'min-w-0 @min-[720px]:flex-1' : 'h-full'}>
            <BookingListCard
              bookings={bookingsQuery.data ?? []}
              tz={tenantTz}
              loading={bookingsQuery.loading}
              pageFind={pageFind}
              minimized={listMin}
              onToggle={() => setListMin((value) => !value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <CompletionGauge stats={statsView} loading={statsBusy} />
        <SocialAccountCard channel="facebook" account={pickChannel(channelsQuery.data, 'facebook')} />
        <SocialAccountCard channel="instagram" account={pickChannel(channelsQuery.data, 'instagram')} />
      </div>
    </PageShell>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        </PageShell>
      }
    >
      <DashboardPageInner />
    </Suspense>
  )
}

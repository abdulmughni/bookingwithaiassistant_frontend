'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useAuth, useOrganization, useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import clsx from 'clsx'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/16/solid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/button'
import { PageShell, dashCardClass } from '@/components/dashboard-ui'
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
  presetRange,
  rangeDayCount,
} from '@/lib/report-range'
import type { TenantStats, Booking } from '@/lib/types'

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

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Last 7 calendar days (oldest → today) with new-booking counts. */
function useWeeklySeries(bookings: Booking[] | null, tz: string) {
  return useMemo(() => {
    const days: { key: string; label: string; isToday: boolean; count: number }[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = dayKeyInTz(d, tz)
      days.push({ key, label: WEEKDAY[d.getDay()], isToday: i === 0, count: 0 })
    }
    const index = new Map(days.map((d, i) => [d.key, i]))
    for (const b of bookings ?? []) {
      const key = dayKeyInTz(new Date(b.created_at), tz)
      const i = index.get(key)
      if (i !== undefined) days[i].count += 1
    }
    const max = Math.max(1, ...days.map((d) => d.count))
    return { days, max, total: days.reduce((s, d) => s + d.count, 0) }
  }, [bookings, tz])
}

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const width = 88
  const height = 36
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
  return (
    <article className={`${dashCardClass} p-4`}>
      <div className="flex items-center gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
          {delta == null ? (
            hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null
          ) : delta === 0 ? (
            <p className="mt-1 text-xs text-zinc-400">No change</p>
          ) : (
            <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {delta > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
              {Math.abs(delta)}% from last month
            </p>
          )}
        </div>
        <Sparkline values={series ?? []} color={stroke} />
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Weekly bar chart (dependency-free)
// ---------------------------------------------------------------------------

function seriesFromDaily(
  daily: { date: string; count: number }[],
  tz: string,
) {
  const today = dayKeyInTz(new Date(), tz)
  if (daily.length > 45) {
    const months = new Map<string, { key: string; label: string; isToday: boolean; count: number }>()
    for (const row of daily) {
      const month = row.date.slice(0, 7)
      const label = new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      })
      const current = months.get(month) ?? {
        key: month,
        label,
        isToday: today.startsWith(month),
        count: 0,
      }
      current.count += row.count
      months.set(month, current)
    }
    return [...months.values()]
  }
  return daily.map((row) => ({
    key: row.date,
    label: new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    isToday: row.date === today,
    count: row.count,
  }))
}

type ChartWindow = 'week' | 'month' | 'year' | 'custom' | 'all'

function chartCaption(kind: ChartWindow) {
  if (kind === 'month') return 'last 30 days'
  if (kind === 'year') return 'this year'
  if (kind === 'custom') return 'selected range'
  return 'last 7 days'
}

function chartChipLabel(kind: ChartWindow, custom?: string) {
  if (kind === 'month') return 'Last 30 days'
  if (kind === 'year') return 'This year'
  if (kind === 'custom') return custom || 'Custom range'
  return 'Last 7 days'
}

function WeeklyBarChart({
  bookings,
  tz,
  loading,
  series,
  windowKind,
  customLabel,
  onPickWindow,
}: {
  bookings: Booking[] | null
  tz: string
  loading: boolean
  series?: { key: string; label: string; isToday: boolean; count: number }[] | null
  windowKind: ChartWindow
  customLabel?: string
  onPickWindow: (kind: 'week' | 'month' | 'year' | 'all') => void
}) {
  const weekly = useWeeklySeries(bookings, tz)
  const days = series ?? weekly.days
  const max = series ? Math.max(1, ...series.map((d) => d.count)) : weekly.max

  const chart = days.map((day) => ({ label: day.label, bookings: day.count }))
  const tickEvery = chart.length > 16 ? Math.ceil(chart.length / 8) - 1 : 0

  return (
    <section className={`${dashCardClass} flex h-full flex-col p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Booking activity</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            New bookings · {chartCaption(windowKind)}
          </p>
        </div>
        <Menu as="div" className="relative shrink-0">
          <MenuButton className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
            {chartChipLabel(windowKind, customLabel)}
            <ChevronDownIcon className="size-3.5 text-zinc-400" />
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            className="z-20 mt-1 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200 [--anchor-gap:6px] focus:outline-none dark:bg-zinc-900 dark:ring-zinc-700"
          >
            {(
              [
                ['week', 'Last 7 days'],
                ['month', 'Last 30 days'],
                ['year', 'This year'],
                ['all', 'All time'],
              ] as const
            ).map(([kind, label]) => (
              <MenuItem key={kind}>
                <button
                  type="button"
                  onClick={() => onPickWindow(kind)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
                >
                  {label}
                </button>
              </MenuItem>
            ))}
          </MenuItems>
        </Menu>
      </div>
      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <div className="mt-2 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barCategoryGap="38%" margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#ececef" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickEvery}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, Math.max(max, 1)]}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e4e4e7',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="bookings" name="Bookings" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
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
    <section className={`${dashCardClass} flex h-full flex-col p-5`}>
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
// Next appointment + upcoming list
// ---------------------------------------------------------------------------

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

function NextAppointmentCard({
  booking,
  tz,
  loading,
}: {
  booking: Booking | null
  tz: string
  loading: boolean
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-linear-to-br from-emerald-950 to-emerald-800 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <ClockIcon className="size-4" />
          Next appointment
        </div>

        {loading ? (
          <div className="mt-6 h-24 animate-pulse rounded-xl bg-white/10" />
        ) : booking ? (
          <>
            <p className="mt-4 text-lg font-semibold text-white">
              {booking.customer_name || 'Customer'}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {booking.service_type || 'Appointment'}
            </p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-white">
              {booking.selected_slot ? formatDateTime(booking.selected_slot, tz) : '—'}
            </p>
            <div className="mt-auto pt-6">
              <Button href="/bookings" color="white">
                View all bookings
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-medium text-white">No upcoming appointments scheduled.</p>
                <p className="mt-1 text-sm text-emerald-100/80">When a client books with you, it will appear here.</p>
              </div>
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-100">
                <CalendarDaysIcon className="size-7" />
              </span>
            </div>
            <div className="mt-auto pt-6">
              <Button href="/bookings" color="white">
                View all bookings
              </Button>
            </div>
          </>
        )}
    </section>
  )
}

function UpcomingList({
  bookings,
  tz,
  loading,
}: {
  bookings: Booking[] | null
  tz: string
  loading: boolean
}) {
  const items = (bookings ?? []).slice(0, 6)

  return (
    <section className={`${dashCardClass} flex h-full flex-col p-5`}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Upcoming appointments</h2>
          <Button href="/bookings" plain className="text-xs">
            View all
            <ArrowUpRightIcon data-slot="icon" />
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-950/5 dark:divide-white/5">
            {items.map((b, i) => (
              <li key={b.id}>
                <a
                  href={`/bookings`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <Avatar name={b.customer_name || 'Customer'} index={i} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      {b.customer_name || 'Customer'}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {b.service_type || 'Appointment'} ·{' '}
                      {b.selected_slot ? formatDateTime(b.selected_slot, tz) : '—'}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <SourceBadge channel={b.source_channel} />
                  </div>
                  <Badge color={statusColor(b.status)} className="shrink-0 capitalize">
                    {b.status}
                  </Badge>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CalendarDaysIcon className="size-7" />
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-950 dark:text-white">No upcoming appointments</p>
            <p className="mt-1 text-sm text-zinc-500">You don&apos;t have any scheduled appointments.</p>
            <Button href="/bookings" color="brand" className="mt-4">
              View all bookings
            </Button>
          </div>
        )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardPageInner() {
  const { user } = useUser()
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
    decoded && orgId && !linkIgnored
      ? { start: decoded.start, end: decoded.end }
      : null
  const today = dayKeyInTz(new Date(), tenantTz)
  const presets = {
    week: presetRange('week', today),
    month: presetRange('month', today),
    year: presetRange('year', today),
  }

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
  useEffect(() => {
    setDraftStart(range?.start ?? '')
    setDraftEnd(range?.end ?? '')
  }, [range?.start, range?.end])

  function openRange(start: string, end: string) {
    if (!orgId || !start || !end || end < start) return
    if (rangeDayCount(start, end) > 366) return
    const token = encodeReportRange(start, end, orgId)
    router.replace(`/?r=${encodeURIComponent(token)}`)
  }

  const { data: upcoming, loading: upcomingLoading } = useApiData<Booking[]>(
    (token) => api.bookings.upcoming(token),
  )

  const { data: allBookings, loading: allLoading } = useApiData<Booking[]>(
    (token) => api.bookings.list(token, { limit: 200 }),
  )

  const sortedUpcoming = useMemo(() => {
    return [...(upcoming ?? [])].sort((a, b) => {
      const ta = a.selected_slot ? new Date(a.selected_slot).getTime() : Infinity
      const tb = b.selected_slot ? new Date(b.selected_slot).getTime() : Infinity
      return ta - tb
    })
  }, [upcoming])

  const businessName = organization?.name || 'Dashboard'

  const windowKind: ChartWindow = !range
    ? 'all'
    : range.start === presets.week.start && range.end === presets.week.end
      ? 'week'
      : range.start === presets.month.start && range.end === presets.month.end
        ? 'month'
        : range.start === presets.year.start && range.end === presets.year.end
          ? 'year'
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">Welcome back{user?.firstName ? `, ${user.firstName}` : ''}</p>
          <h1 className="mt-0.5 truncate text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">{businessName}</h1>
          <p className="mt-1 text-sm text-zinc-500">Here is your booking activity at a glance.</p>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
            {(
              [
                ['week', 'Week'],
                ['month', 'Month'],
                ['year', 'Year'],
              ] as const
            ).map(([kind, label]) => {
              const selected = range?.start === presets[kind].start && range?.end === presets[kind].end
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => openRange(presets[kind].start, presets[kind].end)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-sm font-semibold',
                    selected ? 'bg-emerald-800 text-white' : 'text-zinc-600 hover:bg-zinc-100',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraftStart(range?.start ?? '')
                setDraftEnd(range?.end ?? '')
                setRangeOpen((open) => !open)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200"
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
                <div className="mt-3 flex gap-2">
                  <Button
                    color="brand"
                    className="flex-1"
                    onClick={() => {
                      openRange(draftStart, draftEnd)
                      setRangeOpen(false)
                    }}
                  >
                    Apply
                  </Button>
                  {range ? (
                    <Button
                      outline
                      onClick={() => {
                        router.replace('/')
                        setRangeOpen(false)
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <Button href="/conversations" outline>
            Conversations
          </Button>
          <Button href="/bookings" color="brand">
            View bookings
          </Button>
          <NotificationBell />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              tone="bg-blue-50 text-blue-600"
              stroke="#2563eb"
              series={statsView?.daily?.map((point) => point.count)}
              delta={percentChange(statsView?.total_bookings ?? 0, statsView?.previous_total_bookings)}
            />
            <KpiCard
              label="Completed"
              value={statsView?.completed_bookings ?? 0}
              hint={`${statsView?.cancelled_bookings ?? 0} cancelled`}
              icon={<CheckCircleIcon className="size-5" />}
              tone="bg-emerald-50 text-emerald-600"
              stroke="#059669"
              series={statsView?.completed_daily?.map((point) => point.count)}
              delta={percentChange(statsView?.completed_bookings ?? 0, statsView?.previous_completed_bookings)}
            />
            <KpiCard
              label="Upcoming"
              value={statsView?.upcoming_bookings ?? 0}
              hint="Scheduled ahead"
              icon={<ClockIcon className="size-5" />}
              tone="bg-violet-50 text-violet-600"
              stroke="#7c3aed"
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
              tone="bg-orange-50 text-orange-600"
              stroke="#ea580c"
              series={statsView?.conversation_daily?.map((point) => point.count)}
              delta={percentChange(statsView?.active_conversations ?? 0, statsView?.previous_active_conversations)}
            />
          </>
        )}
      </div>

      {/* Chart + gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyBarChart
            bookings={allBookings}
            tz={tenantTz}
            loading={range ? statsBusy : allLoading}
            series={
              range && statsView?.daily
                ? seriesFromDaily(statsView.daily, tenantTz)
                : null
            }
            windowKind={windowKind}
            customLabel={range ? formatRangeLabel(range.start, range.end) : undefined}
            onPickWindow={(kind) => {
              if (kind === 'all') {
                router.replace('/')
                return
              }
              openRange(presets[kind].start, presets[kind].end)
            }}
          />
        </div>
        <div>
          <CompletionGauge stats={statsView} loading={statsBusy} />
        </div>
      </div>

      {/* Next appointment + upcoming list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div>
          <NextAppointmentCard
            booking={sortedUpcoming[0] ?? null}
            tz={tenantTz}
            loading={upcomingLoading}
          />
        </div>
        <div className="lg:col-span-2">
          <UpcomingList
            bookings={sortedUpcoming}
            tz={tenantTz}
            loading={upcomingLoading}
          />
        </div>
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

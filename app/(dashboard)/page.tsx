'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/button'
import { PageHeader, PageShell } from '@/components/dashboard-ui'
import { Input } from '@/components/input'
import { Badge } from '@/components/badge'
import { Card, CardBody } from '@/components/card'
import { SourceBadge } from '@/components/channel-icon'
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

function KpiCard({
  label,
  value,
  hint,
  icon,
  highlight = false,
}: {
  label: string
  value: number | string
  hint?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border p-5 transition',
        highlight
          ? 'border-transparent bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20'
          : 'border-zinc-200/80 bg-white shadow-sm hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={clsx(
            'text-sm font-medium',
            highlight ? 'text-brand-50' : 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          {label}
        </p>
        <span
          className={clsx(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            highlight
              ? 'bg-white/20 text-white'
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={clsx(
          'mt-3 text-3xl font-semibold tracking-tight',
          highlight ? 'text-white' : 'text-zinc-950 dark:text-white',
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={clsx(
            'mt-1 text-xs font-medium',
            highlight ? 'text-brand-50/90' : 'text-zinc-400 dark:text-zinc-500',
          )}
        >
          {hint}
        </p>
      )}
    </div>
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
    label:
      daily.length > 14
        ? row.date.slice(8)
        : new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
    isToday: row.date === today,
    count: row.count,
  }))
}

function WeeklyBarChart({
  bookings,
  tz,
  loading,
  series,
  subtitle,
}: {
  bookings: Booking[] | null
  tz: string
  loading: boolean
  series?: { key: string; label: string; isToday: boolean; count: number }[] | null
  subtitle?: string
}) {
  const weekly = useWeeklySeries(bookings, tz)
  const days = series ?? weekly.days
  const max = series ? Math.max(1, ...series.map((d) => d.count)) : weekly.max
  const total = series ? series.reduce((sum, day) => sum + day.count, 0) : weekly.total

  return (
    <Card className="h-full border-zinc-200/80 dark:border-zinc-700/80">
      <CardBody className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
              Booking activity
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle ?? 'New bookings · last 7 days'}
            </p>
          </div>
          <Badge color="blue" className="text-xs">
            {total} total
          </Badge>
        </div>

        {loading ? (
          <div className="mt-8 h-44 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <div className="mt-8 flex flex-1 items-end justify-between gap-2 sm:gap-4">
            {days.map((d, i) => {
              const pct = Math.round((d.count / max) * 100)
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex h-40 w-full items-end justify-center">
                    <div className="absolute inset-x-2 inset-y-0 rounded-lg bg-zinc-100 dark:bg-zinc-800/60" />
                    <div
                      className={clsx(
                        'relative w-full max-w-11 rounded-lg transition-all duration-500',
                        d.isToday
                          ? 'bg-linear-to-t from-brand-600 to-brand-400'
                          : 'bg-brand-500/80 dark:bg-brand-500/60',
                      )}
                      style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 3)}%` }}
                      title={`${d.count} booking${d.count === 1 ? '' : 's'}`}
                    >
                      {d.count > 0 && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                          {d.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'text-xs font-medium',
                      d.isToday
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-zinc-400 dark:text-zinc-500',
                    )}
                  >
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
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
    <Card className="h-full border-zinc-200/80 dark:border-zinc-700/80">
      <CardBody className="flex h-full flex-col">
        <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
          Completion rate
        </h3>

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
                    <stop offset="0%" stopColor="#5c7aff" />
                    <stop offset="100%" stopColor="#2b44ff" />
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
              <GaugeLegend color="bg-brand-500" label="Completed" value={completed} />
              <GaugeLegend
                color="bg-sky-400"
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
      </CardBody>
    </Card>
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
    <Card className="h-full overflow-hidden border-transparent bg-linear-to-br from-zinc-900 to-zinc-800 text-white shadow-lg dark:from-zinc-800 dark:to-zinc-900">
      <CardBody className="flex h-full flex-col">
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
              <Button href="/bookings" color="white" className="w-full">
                View bookings
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-1 flex-col">
            <p className="text-sm text-zinc-300">
              No upcoming appointments scheduled.
            </p>
            <div className="mt-auto pt-6">
              <Button href="/conversations" color="white" className="w-full">
                Open conversations
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
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
    <Card className="h-full border-zinc-200/80 dark:border-zinc-700/80">
      <CardBody className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
            Upcoming appointments
          </h3>
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
          <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No upcoming appointments
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardPageInner() {
  const { user } = useUser()
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

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''} — here is your booking activity at a glance.`}
      >
        <Button href="/conversations" outline>
          Conversations
        </Button>
        <Button href="/bookings" color="brand">
          View bookings
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/80 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['week', 'Week'],
              ['month', 'Month'],
              ['year', 'Year'],
            ] as const
          ).map(([kind, label]) => {
            const selected =
              range?.start === presets[kind].start && range?.end === presets[kind].end
            return (
              <button
                key={kind}
                type="button"
                onClick={() => openRange(presets[kind].start, presets[kind].end)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold',
                  selected
                    ? 'bg-brand-500 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          Start date
          <Input
            type="date"
            value={draftStart}
            onChange={(event) => {
              const next = event.target.value
              setDraftStart(next)
              openRange(next, draftEnd)
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
          End date
          <Input
            type="date"
            value={draftEnd}
            onChange={(event) => {
              const next = event.target.value
              setDraftEnd(next)
              openRange(draftStart, next)
            }}
          />
        </label>
        {range && (
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Clear
          </button>
        )}
        {range && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 sm:ml-auto">
            {formatRangeLabel(range.start, range.end)}
          </p>
        )}
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
              icon={<CalendarDaysIcon className="size-4" />}
              highlight
            />
            <KpiCard
              label="Completed"
              value={statsView?.completed_bookings ?? 0}
              hint={`${statsView?.cancelled_bookings ?? 0} cancelled`}
              icon={<CheckCircleIcon className="size-4" />}
            />
            <KpiCard
              label="Upcoming"
              value={statsView?.upcoming_bookings ?? 0}
              hint="Scheduled ahead"
              icon={<ClockIcon className="size-4" />}
            />
            <KpiCard
              label={range ? 'Conversations' : 'Active conversations'}
              value={statsView?.active_conversations ?? 0}
              hint={
                range
                  ? 'Started in this range'
                  : `${statsView?.total_channel_accounts ?? 0} channels`
              }
              icon={<ChatBubbleLeftRightIcon className="size-4" />}
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
            subtitle={
              range ? `New bookings · ${formatRangeLabel(range.start, range.end)}` : undefined
            }
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

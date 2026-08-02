'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowPathIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  MoonIcon,
  PhoneArrowDownLeftIcon,
  PhoneXMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/button'
import { PageHeader, PageShell, SkeletonBlock } from '@/components/dashboard-ui'
import { Card, CardBody } from '@/components/card'
import { useApiData } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

type Period = 'week' | 'month'

const STATUS_COLORS = {
  upcoming: '#0ea5e9',
  completed: '#10b981',
  no_show: '#f59e0b',
} as const

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function formatDelta(
  n: number | null | undefined,
  opts?: { moneyValue?: boolean; pct?: boolean },
): string {
  if (n == null || Number.isNaN(n)) return 'vs prior period'
  if (n === 0) return 'Same as prior period'
  const sign = n > 0 ? '+' : ''
  if (opts?.moneyValue) return `${sign}${money(n)} vs prior`
  if (opts?.pct) return `${sign}${n.toFixed(1)} pts vs prior`
  return `${sign}${n.toLocaleString()} vs prior`
}

function deltaTone(n: number | null | undefined, opts?: { invert?: boolean }): string {
  if (n == null || n === 0) return 'text-zinc-500 dark:text-zinc-400'
  const good = opts?.invert ? n < 0 : n > 0
  return good
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-amber-700 dark:text-amber-400'
}

function periodRangeLabel(start: string, end: string, tz: string): string {
  return `${formatDate(start, tz)} – ${formatDate(end, tz)}`
}

export default function CallStatsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const { data, loading, error, refetch } = useApiData(
    (token) => api.calls.stats(token, period),
    [period],
  )

  const dailyData = useMemo(() => data?.daily_volume ?? [], [data?.daily_volume])

  const statusData = useMemo(() => {
    const s = data?.bookings_by_status
    if (!s) return []
    return [
      { key: 'upcoming', name: 'Upcoming', value: s.upcoming, fill: STATUS_COLORS.upcoming },
      { key: 'completed', name: 'Completed', value: s.completed, fill: STATUS_COLORS.completed },
      { key: 'no_show', name: 'No-show', value: s.no_show, fill: STATUS_COLORS.no_show },
    ].filter((row) => row.value > 0)
  }, [data?.bookings_by_status])

  const cur = data?.current
  const deltas = data?.deltas
  const protection = data?.quota_protection
  const isEmpty = data && !data.has_activity

  return (
    <PageShell>
      <PageHeader
        title="Call value"
        description={
          data
            ? `${period === 'week' ? 'Last 7 days' : 'Month to date'} · ${periodRangeLabel(data.current_start, data.current_end, data.timezone)}`
            : 'What your AI phone line earned this period — jobs booked, dollars, and coverage you would have missed.'
        }
      >
        <Button plain onClick={() => void refetch()} disabled={loading}>
          <ArrowPathIcon data-slot="icon" className={clsx(loading && 'animate-spin')} />
          Refresh
        </Button>
        <Button href="/calls" outline>
          View calls
        </Button>
        <PeriodToggle value={period} onChange={setPeriod} />
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {loading || !data || !cur ? (
        <div className="space-y-4">
          <SkeletonBlock className="h-40" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-72" />
          </div>
        </div>
      ) : isEmpty ? (
        <EmptyStats period={period} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <MoneyHero
              label="Jobs booked"
              value={cur.jobs_booked.toLocaleString()}
              hint={formatDelta(deltas?.jobs_booked)}
              tone={deltaTone(deltas?.jobs_booked)}
              icon={<CalendarDaysIcon className="size-6" />}
              highlight
            />
            <MoneyHero
              label="Estimated $ captured"
              value={money(cur.estimated_value)}
              hint={`${formatDelta(deltas?.estimated_value, { moneyValue: true })} · fallback $${data.avg_job_value_fallback.toLocaleString()}/job when unset`}
              tone={deltaTone(deltas?.estimated_value)}
              icon={<BanknotesIcon className="size-6" />}
              highlight
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Calls answered"
              value={cur.calls_answered.toLocaleString()}
              hint={formatDelta(deltas?.calls_answered)}
              hintClass={deltaTone(deltas?.calls_answered)}
              icon={<PhoneArrowDownLeftIcon className="size-5" />}
            />
            <KpiCard
              label="Calls → bookings"
              value={cur.conversion_pct == null ? '—' : `${cur.conversion_pct}%`}
              hint={`${cur.booked_calls} booked · ${formatDelta(deltas?.conversion_pct, { pct: true })}`}
              hintClass={deltaTone(deltas?.conversion_pct)}
              icon={<ChartBarIcon className="size-5" />}
            />
            <KpiCard
              label="After-hours answered"
              value={cur.after_hours_calls.toLocaleString()}
              hint={formatDelta(deltas?.after_hours_calls)}
              hintClass={deltaTone(deltas?.after_hours_calls)}
              icon={<MoonIcon className="size-5" />}
            />
            <KpiCard
              label="Unbooked calls"
              value={cur.unbooked_calls.toLocaleString()}
              hint={formatDelta(deltas?.unbooked_calls)}
              hintClass={deltaTone(deltas?.unbooked_calls, { invert: true })}
              icon={<PhoneXMarkIcon className="size-5" />}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label="Avg call length"
              value={formatDuration(cur.avg_call_duration_seconds)}
              hint="Ended calls with a recorded duration"
              icon={<ClockIcon className="size-5" />}
            />
            <KpiCard
              label="Spam filtered"
              value={(protection?.calls_filtered ?? 0).toLocaleString()}
              hint={
                (protection?.minutes_saved ?? 0) > 0
                  ? `${protection?.minutes_saved} min not billed · spam under 20s`
                  : 'Spam under 20s is not billed'
              }
              icon={<ShieldCheckIcon className="size-5" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Calls per day"
              subtitle={`Daily volume · ${data.timezone}`}
              empty={dailyData.every((d) => d.count === 0)}
              emptyMessage="No calls recorded in this period."
            >
              <BarChart data={dailyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={period === 'month' ? Math.floor(dailyData.length / 8) : 0}
                  className="fill-zinc-500"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-zinc-500" />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.15)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgb(228 228 231)',
                    fontSize: 12,
                  }}
                  formatter={(value) => [String(value ?? 0), 'Calls']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ChartCard>

            <ChartCard
              title="Bookings by status"
              subtitle="Voice bookings created this period"
              empty={statusData.length === 0}
              emptyMessage="No voice bookings in this period."
            >
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.15)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgb(228 228 231)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartCard>
          </div>
        </>
      )}
    </PageShell>
  )
}

function EmptyStats({ period }: { period: Period }) {
  return (
    <Card className="border-dashed border-zinc-300 dark:border-zinc-700">
      <CardBody className="py-16 text-center">
        <PhoneArrowDownLeftIcon className="mx-auto size-12 text-zinc-300 dark:text-zinc-600" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">
          No call activity yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {period === 'week'
            ? 'When your AI line answers calls this week, jobs booked and conversion will show up here automatically.'
            : 'When your AI line answers calls this month, jobs booked and conversion will show up here automatically.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button href="/voice" color="brand">
            Set up voice
          </Button>
          <Button href="/calls" outline>
            View call log
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function ChartCard({
  title,
  subtitle,
  empty,
  emptyMessage,
  children,
}: {
  title: string
  subtitle: string
  empty: boolean
  emptyMessage: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80">
      <CardBody>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h3>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        {empty ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-200 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {emptyMessage}
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: Period
  onChange: (p: Period) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {(
        [
          { id: 'week', label: 'This week' },
          { id: 'month', label: 'This month' },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === opt.id
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function MoneyHero({
  label,
  value,
  hint,
  tone,
  icon,
  highlight,
}: {
  label: string
  value: string
  hint: string
  tone: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border p-6 shadow-sm',
        highlight
          ? 'border-transparent bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20'
          : 'border-zinc-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={clsx('text-sm font-medium', highlight ? 'text-brand-50' : 'text-zinc-500')}>
          {label}
        </p>
        <span
          className={clsx(
            'flex size-10 items-center justify-center rounded-full',
            highlight ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500',
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={clsx(
          'mt-4 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl',
          highlight ? 'text-white' : 'text-zinc-950 dark:text-white',
        )}
      >
        {value}
      </p>
      <p className={clsx('mt-2 text-sm font-medium', highlight ? 'text-brand-50/90' : tone)}>
        {hint}
      </p>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  hintClass,
  icon,
}: {
  label: string
  value: string
  hint?: string
  hintClass?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">
        {value}
      </p>
      {hint ? (
        <p className={clsx('mt-1 text-xs font-medium', hintClass ?? 'text-zinc-400')}>{hint}</p>
      ) : null}
    </div>
  )
}

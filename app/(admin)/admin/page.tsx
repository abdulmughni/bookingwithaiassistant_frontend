'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  PauseIcon,
  PhoneIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { BellIcon } from '@heroicons/react/24/outline'

import { ActivityBars } from '@/components/activity-bars'
import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '@/components/dropdown'
import { HealthDot } from '@/components/admin/ops'
import { StatusBadge, formatDate } from '@/components/admin/shared'
import { AgencyHome } from '@/components/admin/agency-home'
import { api } from '@/lib/api'
import { useApiData, useIsAdmin } from '@/lib/hooks'
import type { AdminAlert, AdminDashboard, AdminFunnel, DashboardMetric } from '@/lib/types'

function alertKey(alert: Pick<AdminAlert, 'tenant_id' | 'rule_key'>) {
  return `${alert.tenant_id}:${alert.rule_key}`
}

function iso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function daysBack(count: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (count - 1))
  return { start: iso(start), end: iso(end) }
}

function thisMonth() {
  const end = new Date()
  return { start: iso(new Date(end.getFullYear(), end.getMonth(), 1)), end: iso(end) }
}

function pretty(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function periodLabel(range: { start: string; end: string }) {
  const options = [
    { label: 'Last 7 days', range: daysBack(7) },
    { label: 'Last 30 days', range: daysBack(30) },
    { label: 'This month', range: thisMonth() },
  ]
  return options.find((option) => option.range.start === range.start && option.range.end === range.end)?.label ?? 'Custom'
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const width = 88
  const height = 32
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((value, index) => `${index * step},${height - 3 - ((value - min) / span) * (height - 8)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-20" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function TrendLine({ metric }: { metric: DashboardMetric }) {
  if (metric.delta_pct == null && metric.value === metric.previous) {
    return <p className="mt-1 text-xs text-zinc-400">— no change</p>
  }
  if (metric.delta_pct == null) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
        <ArrowUpIcon className="size-3" />
        new
      </p>
    )
  }
  const up = metric.delta_pct >= 0
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
      {Math.abs(metric.delta_pct)}% from last month
    </p>
  )
}

function MetricCard({
  label,
  metric,
  icon,
  tone,
  stroke,
  href,
  money,
}: {
  label: string
  metric: DashboardMetric
  icon: ReactNode
  tone: string
  stroke: string
  href?: string
  money?: boolean
}) {
  const shown = money
    ? `$${Math.round(metric.value).toLocaleString()}`
    : Math.round(metric.value).toLocaleString()
  const body = (
    <div className="flex items-center gap-3">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950">{shown}</p>
        <TrendLine metric={metric} />
      </div>
      <Sparkline values={metric.series} color={stroke} />
    </div>
  )
  const className = `${dashCardClass} block h-full p-4 transition hover:shadow-md`
  if (!href) return <article className={className}>{body}</article>
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  )
}

function PeriodMenu({
  value,
  onChange,
}: {
  value: { start: string; end: string }
  onChange: (range: { start: string; end: string }) => void
}) {
  const options = [
    { label: 'Last 7 days', range: daysBack(7) },
    { label: 'Last 30 days', range: daysBack(30) },
    { label: 'This month', range: thisMonth() },
  ]
  return (
    <Dropdown>
      <DropdownButton
        as="button"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
      >
        {periodLabel(value)}
        <ChevronDownIcon className="size-3.5" />
      </DropdownButton>
      <DropdownMenu anchor="bottom end">
        {options.map((option) => (
          <DropdownItem key={option.label} onClick={() => onChange(option.range)}>
            {option.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}

function FunnelPanel({ funnel, range, onChange }: { funnel: AdminFunnel; range: { start: string; end: string }; onChange: (range: { start: string; end: string }) => void }) {
  const steps = [
    { label: 'Total bookings', value: funnel.total_bookings ?? funnel.conversations, pct: null as number | null, tint: 'bg-blue-50 text-blue-700' },
    { label: 'From messages', value: funnel.message_bookings ?? funnel.booking_intent, pct: funnel.conv_to_intent_pct, tint: 'bg-emerald-50 text-emerald-700' },
    { label: 'From calls', value: funnel.call_bookings ?? funnel.booked, pct: funnel.intent_to_booked_pct, tint: 'bg-teal-50 text-teal-700' },
    { label: 'Completed', value: funnel.completed_bookings ?? funnel.completed, pct: funnel.booked_to_completed_pct, tint: 'bg-amber-50 text-amber-800' },
  ]
  return (
    <section className={`${dashCardClass} flex h-full flex-col p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-950">Company funnel (this month)</h3>
        <PeriodMenu value={range} onChange={onChange} />
      </div>
      <div className="mt-4 grid items-center gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-2.5">
          {steps.map((step) => (
            <div key={step.label} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${step.tint}`}>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                {step.pct != null ? <p className="text-xs opacity-80">{step.pct}% of bookings</p> : null}
              </div>
              <p className="text-lg font-semibold tabular-nums">{step.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 px-2">
          <div>
            <p className="text-xs text-zinc-500">Booking conversion</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-950">
              {funnel.booking_conversion_pct == null ? '—' : `${funnel.booking_conversion_pct}%`}
            </p>
            <p className="mt-4 text-xs text-zinc-500">Company average</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950">
              {funnel.company_avg_conversion_pct == null ? '—' : `${funnel.company_avg_conversion_pct}%`}
            </p>
          </div>
          <ConversionRing pct={funnel.booking_conversion_pct} />
        </div>
      </div>
    </section>
  )
}

function ConversionRing({ pct }: { pct: number | null }) {
  const shown = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dash = (shown / 100) * circumference
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 96 96" className="size-28 -rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#dbeafe" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-semibold text-blue-600">
        {pct == null ? '—' : `${pct}%`}
      </span>
    </div>
  )
}

function ActivityChart({
  points,
  range,
  onChange,
}: {
  points: AdminDashboard['activity']
  range: { start: string; end: string }
  onChange: (range: { start: string; end: string }) => void
}) {
  return (
    <ActivityBars
      title="Platform activity"
      subtitle="Bookings, calls and messages across all agencies and clients."
      points={points}
      menu={<PeriodMenu value={range} onChange={onChange} />}
    />
  )
}

function SuperAdminOverview() {
  const [cardRange, setCardRange] = useState(daysBack(30))
  const [draft, setDraft] = useState(daysBack(30))
  const [rangeOpen, setRangeOpen] = useState(false)
  const [funnelRange, setFunnelRange] = useState(daysBack(30))
  const [chartRange, setChartRange] = useState(daysBack(30))
  const [bellOpen, setBellOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const overview = useApiData((token) => api.admin.overview(token), [])
  const dashboard = useApiData(
    (token) =>
      api.admin.overviewDashboard(token, {
        start: cardRange.start,
        end: cardRange.end,
        funnelStart: funnelRange.start,
        funnelEnd: funnelRange.end,
        chartStart: chartRange.start,
        chartEnd: chartRange.end,
      }),
    [cardRange.start, cardRange.end, funnelRange.start, funnelRange.end, chartRange.start, chartRange.end],
  )
  const alerts = useMemo(
    () => (overview.data?.alerts ?? []).filter((alert) => !dismissed.has(alertKey(alert))),
    [overview.data?.alerts, dismissed],
  )
  function refresh() {
    void overview.refetch()
    void dashboard.refetch()
  }

  const stats = dashboard.data

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Welcome back,</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-zinc-950">Admin Console</h1>
          <p className="mt-1 text-sm text-zinc-500">Here&apos;s what&apos;s happening across your platform today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraft(cardRange)
                setRangeOpen((open) => !open)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200"
            >
              <CalendarDaysIcon className="size-4 text-zinc-400" />
              {pretty(cardRange.start)} – {pretty(cardRange.end)}
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
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="mt-2 block text-xs font-medium text-zinc-500">
                  To
                  <input
                    type="date"
                    value={draft.end}
                    onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <Button
                  color="brand"
                  className="mt-3 w-full"
                  onClick={() => {
                    if (!draft.start || !draft.end) return
                    setCardRange(draft.start <= draft.end ? draft : { start: draft.end, end: draft.start })
                    setRangeOpen(false)
                  }}
                >
                  Apply
                </Button>
              </div>
            ) : null}
          </div>
          <Button color="brand" onClick={refresh}>
            <ArrowPathIcon data-slot="icon" />
            Refresh Data
          </Button>
          <div className="relative">
            <button
              type="button"
              aria-label="Alerts"
              onClick={() => setBellOpen((open) => !open)}
              className="relative flex size-10 items-center justify-center rounded-xl bg-zinc-50 text-zinc-600 shadow-sm ring-1 ring-zinc-200 hover:bg-white"
            >
              <BellIcon className="size-5" />
              {alerts.length > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500" />
              ) : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl bg-white p-2 shadow-lg ring-1 ring-zinc-200">
                <p className="px-2 py-1.5 text-sm font-semibold text-zinc-950">Needs action today</p>
                {alerts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-zinc-500">All clients healthy</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {alerts.map((alert) => (
                      <li key={alertKey(alert)} className="rounded-lg px-2 py-2 hover:bg-zinc-50">
                        <div className="flex items-start gap-2">
                          <HealthDot health={alert.severity} size="md" className="mt-1" />
                          <div className="min-w-0 flex-1">
                            <Link href={`/admin/clients/${encodeURIComponent(alert.tenant_id)}`} className="text-sm font-medium text-zinc-950">
                              {alert.tenant_name}
                            </Link>
                            <p className="text-xs text-zinc-500">{alert.reason}</p>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-medium text-zinc-400 hover:text-zinc-700"
                            onClick={() =>
                              setDismissed((current) => {
                                const next = new Set(current)
                                next.add(alertKey(alert))
                                return next
                              })
                            }
                          >
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {overview.error ? <p className="text-sm text-red-600">{overview.error}</p> : null}
      {dashboard.error ? <p className="text-sm text-red-600">{dashboard.error}</p> : null}

      {!stats || dashboard.loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <SkeletonBlock key={item} className="h-40" />
            ))}
          </div>
          <SkeletonBlock className="h-72" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Clients" metric={stats.clients} href="/admin/clients" icon={<UsersIcon className="size-5" />} tone="bg-blue-50 text-blue-600" stroke="#2563eb" />
            <MetricCard label="Active" metric={stats.active} href="/admin/clients?status=active" icon={<CheckCircleIcon className="size-5" />} tone="bg-emerald-50 text-emerald-600" stroke="#10b981" />
            <MetricCard label="Pending activation" metric={stats.pending} href="/admin/clients?status=pending" icon={<ClockIcon className="size-5" />} tone="bg-amber-50 text-amber-600" stroke="#f59e0b" />
            <MetricCard label="Suspended" metric={stats.suspended} href="/admin/clients?status=suspended" icon={<PauseIcon className="size-5" />} tone="bg-rose-50 text-rose-600" stroke="#f43f5e" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total Bookings" metric={stats.bookings} icon={<CalendarDaysIcon className="size-5" />} tone="bg-sky-50 text-sky-600" stroke="#0284c7" />
            <MetricCard label="Conversations" metric={stats.conversations} icon={<ChatBubbleLeftRightIcon className="size-5" />} tone="bg-violet-50 text-violet-600" stroke="#7c3aed" />
            <MetricCard label="Calls" metric={stats.calls} icon={<PhoneIcon className="size-5" />} tone="bg-cyan-50 text-cyan-600" stroke="#0891b2" />
            <MetricCard label="Messages" metric={stats.messages} icon={<EnvelopeIcon className="size-5" />} tone="bg-indigo-50 text-indigo-600" stroke="#4f46e5" />
            <MetricCard label="$ recovered this month" metric={stats.recovered} money icon={<BanknotesIcon className="size-5" />} tone="bg-emerald-50 text-emerald-600" stroke="#059669" />
          </div>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <FunnelPanel funnel={stats.funnel} range={funnelRange} onChange={setFunnelRange} />
            <ActivityChart points={stats.activity} range={chartRange} onChange={setChartRange} />
          </div>
        </>
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section className={`${dashCardClass} flex flex-col`}>
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-base font-semibold text-zinc-950">Recent sign-ups</h3>
            <Link href="/admin/clients" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto_auto] gap-3 px-5 pb-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
            <span>Client</span>
            <span>Agency</span>
            <span>Joined</span>
            <span>Status</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {(overview.data?.recent_tenants.length ?? 0) === 0 && !overview.loading ? (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">No clients yet.</li>
            ) : null}
            {(overview.data?.recent_tenants ?? []).map((tenant) => (
              <li key={tenant.id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-5 py-3">
                <Link href={`/admin/clients/${encodeURIComponent(tenant.id)}`} className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <BuildingOffice2Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <HealthDot health={tenant.health ?? 'green'} />
                    <span className="truncate text-sm font-medium text-zinc-950">{tenant.name}</span>
                  </span>
                </Link>
                <span className="truncate text-sm text-zinc-500">{tenant.parent_name || '—'}</span>
                <span className="text-sm text-zinc-500">{formatDate(tenant.created_at)}</span>
                <StatusBadge status={tenant.account_status} />
                <Dropdown>
                  <DropdownButton as="button" aria-label={`Actions for ${tenant.name}`} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                    <EllipsisHorizontalIcon className="size-5" />
                  </DropdownButton>
                  <DropdownMenu anchor="bottom end">
                    <DropdownItem href={`/admin/clients/${encodeURIComponent(tenant.id)}`}>Open client</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${dashCardClass} flex min-h-72 flex-col`}>
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-base font-semibold text-zinc-950">
              Open plan requests
              {(overview.data?.open_plan_requests ?? 0) > 0 ? (
                <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {overview.data?.open_plan_requests}
                </span>
              ) : null}
            </h3>
            <Link href="/admin/requests" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Manage
            </Link>
          </div>
          {(overview.data?.recent_requests.length ?? 0) === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <DocumentTextIcon className="size-7" />
              </span>
              <p className="mt-4 text-sm text-zinc-500">No open requests. All caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(overview.data?.recent_requests ?? []).map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-950">{request.tenant_name ?? request.tenant_id}</p>
                    <p className="truncate text-xs text-zinc-500">
                      Wants <span className="font-medium text-zinc-700">{request.requested_plan_id ?? 'a plan change'}</span>
                      {request.message ? ` — “${request.message}”` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{formatDate(request.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  )
}

export default function AdminOverviewPage() {
  const { isAgency, loading } = useIsAdmin()
  if (loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }
  if (isAgency) return <AgencyHome />
  return <SuperAdminOverview />
}

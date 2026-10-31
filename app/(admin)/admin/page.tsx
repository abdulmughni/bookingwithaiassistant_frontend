'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowPathIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PauseIcon,
  PhoneIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { BellIcon } from '@heroicons/react/24/outline'

import { ActivityBars } from '@/components/activity-bars'
import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { KpiStatCard } from '@/components/kpi-stat-card'
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

function metricTrend(metric: DashboardMetric): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (metric.delta_pct == null && metric.value === metric.previous) return { text: '— no change', tone: 'flat' }
  if (metric.delta_pct == null) return { text: 'new', tone: 'up' }
  const up = metric.delta_pct >= 0
  return { text: `${Math.abs(metric.delta_pct)}% from last month`, tone: up ? 'up' : 'down' }
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
  const trend = metricTrend(metric)
  return (
    <KpiStatCard
      label={label}
      value={shown}
      trend={trend.text}
      trendTone={trend.tone}
      icon={icon}
      tone={tone}
      stroke={stroke}
      series={metric.series}
      href={href}
    />
  )
}

function CardFind({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="group relative mt-2.5 block">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400 transition group-focus-within:text-blue-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg bg-zinc-100/60 pr-7 pl-8 text-[13px] text-zinc-700 outline-none transition placeholder:text-zinc-400 focus:bg-zinc-100"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white hover:text-zinc-700"
        >
          <XMarkIcon className="size-3.5" />
        </button>
      ) : null}
    </label>
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
    <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
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
      variant="premium"
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
  const [signupFind, setSignupFind] = useState('')
  const [requestFind, setRequestFind] = useState('')
  const [pageFind, setPageFind] = useState('')
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
      <div className="flex flex-col gap-5">
        <div className="flex w-full flex-wrap items-center gap-3">
          <label className="relative w-full max-w-[50%]">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={pageFind}
              onChange={(event) => setPageFind(event.target.value)}
              placeholder="Search clients, bookings, requests..."
              className="h-11 w-full rounded-full border border-zinc-200/80 bg-white pr-4 pl-11 text-sm text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setDraft(cardRange)
                setRangeOpen((open) => !open)
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200"
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
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <ArrowPathIcon className="size-4" />
            Refresh Data
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Alerts"
              onClick={() => setBellOpen((open) => !open)}
              className="relative flex size-11 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50"
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
        <div>
          <h1 className="text-[1.7rem] font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Welcome back, Admin Console <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Here&apos;s what&apos;s happening across your platform today.</p>
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
            <MetricCard label="Total Clients" metric={stats.clients} href="/admin/clients" icon={<UsersIcon className="size-5" />} tone="bg-blue-100 text-blue-500" stroke="#60a5fa" />
            <MetricCard label="Active" metric={stats.active} href="/admin/clients?status=active" icon={<CheckCircleIcon className="size-5" />} tone="bg-emerald-100 text-emerald-500" stroke="#34d399" />
            <MetricCard label="Pending activation" metric={stats.pending} href="/admin/clients?status=pending" icon={<ClockIcon className="size-5" />} tone="bg-amber-100 text-amber-500" stroke="#fbbf24" />
            <MetricCard label="Suspended" metric={stats.suspended} href="/admin/clients?status=suspended" icon={<PauseIcon className="size-5" />} tone="bg-rose-100 text-rose-500" stroke="#fb7185" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total Bookings" metric={stats.bookings} icon={<CalendarDaysIcon className="size-5" />} tone="bg-violet-100 text-violet-500" stroke="#a78bfa" />
            <MetricCard label="Conversations" metric={stats.conversations} icon={<ChatBubbleLeftRightIcon className="size-5" />} tone="bg-sky-100 text-sky-500" stroke="#38bdf8" />
            <MetricCard label="Calls" metric={stats.calls} icon={<PhoneIcon className="size-5" />} tone="bg-emerald-100 text-emerald-500" stroke="#34d399" />
            <MetricCard label="Messages" metric={stats.messages} icon={<EnvelopeIcon className="size-5" />} tone="bg-orange-100 text-orange-500" stroke="#fb923c" />
            <MetricCard label="$ recovered this month" metric={stats.recovered} money icon={<BanknotesIcon className="size-5" />} tone="bg-rose-100 text-rose-500" stroke="#fb7185" />
          </div>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <FunnelPanel funnel={stats.funnel} range={funnelRange} onChange={setFunnelRange} />
            <div className="flex h-full min-h-0 flex-col">
              <ActivityChart points={stats.activity} range={chartRange} onChange={setChartRange} />
            </div>
          </div>
        </>
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-950">Recent sign-ups</h3>
            <Link href="/admin/clients" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          <CardFind value={signupFind} placeholder="Search sign-ups" onChange={setSignupFind} />
          <div className="scroll-hide mt-3 max-h-[18.25rem] overflow-auto overscroll-contain">
            <div className="grid min-w-[36rem] grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto_auto] gap-3 pb-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
              <span>Client</span>
              <span>Agency</span>
              <span>Joined</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="min-w-[36rem] divide-y divide-zinc-100">
              {(overview.data?.recent_tenants.length ?? 0) === 0 && !overview.loading ? (
                <li className="py-10 text-center text-sm text-zinc-500">No clients yet.</li>
              ) : null}
              {(overview.data?.recent_tenants ?? [])
                .filter((tenant) => {
                  const blob = `${tenant.name} ${tenant.parent_name ?? ''}`.toLowerCase()
                  const card = signupFind.trim().toLowerCase()
                  const page = pageFind.trim().toLowerCase()
                  if (card && !blob.includes(card)) return false
                  if (page && !blob.includes(page)) return false
                  return true
                })
                .map((tenant) => (
              <li key={tenant.id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto_auto] items-center gap-3 py-3">
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
          </div>
        </section>

        <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              Open plan requests
              {(overview.data?.open_plan_requests ?? 0) > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                  {overview.data?.open_plan_requests}
                </span>
              ) : null}
            </h3>
            <Link href="/admin/requests" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Manage
            </Link>
          </div>
          <CardFind value={requestFind} placeholder="Search requests" onChange={setRequestFind} />
          {(overview.data?.recent_requests.length ?? 0) === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <DocumentTextIcon className="size-7" />
              </span>
              <p className="mt-4 text-sm text-zinc-500">No open requests. All caught up.</p>
            </div>
          ) : (
            <ul className="scroll-hide mt-1 max-h-[18.25rem] divide-y divide-zinc-100 overflow-y-auto overscroll-contain">
              {(overview.data?.recent_requests ?? [])
                .filter((request) => {
                  const blob = `${request.tenant_name ?? ''} ${request.requested_plan_id ?? ''} ${request.message ?? ''}`.toLowerCase()
                  const card = requestFind.trim().toLowerCase()
                  const page = pageFind.trim().toLowerCase()
                  if (card && !blob.includes(card)) return false
                  if (page && !blob.includes(page)) return false
                  return true
                })
                .map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 py-3.5">
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

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
  EnvelopeIcon,
  PauseIcon,
  PhoneIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

import { Button } from '@/components/button'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { AdminAlertPanel, HealthDot } from '@/components/admin/ops'
import { StatusBadge, formatDate } from '@/components/admin/shared'
import { AgencyHome } from '@/components/admin/agency-home'
import { api } from '@/lib/api'
import { useApiData, useIsAdmin } from '@/lib/hooks'
import type { AdminAlert, AdminFunnel } from '@/lib/types'

/** Session-only dashboard dismiss keys (not persisted). */
function alertKey(a: Pick<AdminAlert, 'tenant_id' | 'rule_key'>) {
  return `${a.tenant_id}:${a.rule_key}`
}

function SuperAdminOverview() {
  const { data, loading, error, refetch } = useApiData((token) => api.admin.overview(token), [])
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(() => new Set())

  const visibleAlerts = useMemo(() => {
    const all = data?.alerts ?? []
    return all.filter((a) => !sessionDismissed.has(alertKey(a)))
  }, [data?.alerts, sessionDismissed])

  const handleDismiss = (alert: AdminAlert) => {
    setSessionDismissed((prev) => {
      const next = new Set(prev)
      next.add(alertKey(alert))
      return next
    })
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Welcome back,</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Admin Console
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Here&apos;s what&apos;s happening across your platform today.</p>
        </div>
        <Button color="brand" onClick={() => void refetch()}>
          <ArrowPathIcon data-slot="icon" />
          Refresh data
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="space-y-6">
          <SkeletonBlock className="h-24" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      ) : (
        <>
          <AdminAlertPanel alerts={visibleAlerts} onDismiss={handleDismiss} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total clients"
              value={data.tenants_total}
              href="/admin/clients"
              icon={<UsersIcon className="size-5" />}
              tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
            />
            <MetricCard
              label="Active"
              value={data.tenants_active}
              href="/admin/clients?status=active"
              icon={<CheckCircleIcon className="size-5" />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
            />
            <MetricCard
              label="Pending activation"
              value={data.tenants_pending}
              href="/admin/clients?status=pending"
              icon={<ClockIcon className="size-5" />}
              tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
            />
            <MetricCard
              label="Suspended"
              value={data.tenants_suspended}
              href="/admin/clients?status=suspended"
              icon={<PauseIcon className="size-5" />}
              tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Bookings (all time)"
              value={data.bookings_total}
              icon={<CalendarDaysIcon className="size-5" />}
              tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
            />
            <MetricCard
              label="Conversations"
              value={data.conversations_total}
              icon={<ChatBubbleLeftRightIcon className="size-5" />}
              tone="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
            />
            <MetricCard
              label="Calls"
              value={data.calls_total}
              icon={<PhoneIcon className="size-5" />}
              tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300"
            />
            <MetricCard
              label="Messages (30 days)"
              value={data.messages_30d}
              icon={<EnvelopeIcon className="size-5" />}
              tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
            />
            <MetricCard
              label="$ recovered this month"
              value={data.recovered_value_this_month ?? 0}
              money
              icon={<BanknotesIcon className="size-5" />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
            />
          </div>

          <OverviewFunnel funnel={data.funnel} />

          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <section className={`${dashCardClass} flex flex-col`}>
              <div className="flex items-center justify-between px-5 py-4">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Recent sign-ups</h3>
                <Link href="/admin/clients" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View all
                </Link>
              </div>
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 px-5 pb-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
                <span>Client</span>
                <span>Plan</span>
                <span>Status</span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.recent_tenants.length === 0 && (
                  <li className="px-5 py-10 text-center text-sm text-zinc-500">No clients yet.</li>
                )}
                {data.recent_tenants.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/clients/${encodeURIComponent(t.id)}`}
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                          <BuildingOffice2Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-zinc-950 dark:text-white">
                            <HealthDot health={t.health ?? 'green'} />
                            <span className="truncate">{t.name}</span>
                          </span>
                          <span className="block truncate text-xs text-zinc-400">Joined {formatDate(t.created_at)}</span>
                        </span>
                      </span>
                      <span className="truncate text-sm text-zinc-500">{t.plan?.name ?? 'No plan'}</span>
                      <StatusBadge status={t.account_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${dashCardClass} flex min-h-72 flex-col`}>
              <div className="flex items-center justify-between px-5 py-4">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                  Open plan requests
                  {data.open_plan_requests > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      {data.open_plan_requests}
                    </span>
                  )}
                </h3>
                <Link href="/admin/requests" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Manage
                </Link>
              </div>
              {data.recent_requests.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-500/10">
                    <DocumentTextIcon className="size-7" />
                  </span>
                  <p className="mt-4 text-sm text-zinc-500">No open requests. All caught up.</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.recent_requests.map((r) => (
                    <li key={r.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                            {r.tenant_name ?? r.tenant_id}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            Wants{' '}
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              {r.requested_plan_id ?? 'a plan change'}
                            </span>
                            {r.message ? ` — “${r.message}”` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-zinc-400">{formatDate(r.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </PageShell>
  )
}

function MetricCard({
  label,
  value,
  icon,
  tone,
  href,
  money,
}: {
  label: string
  value: number
  icon: ReactNode
  tone: string
  href?: string
  money?: boolean
}) {
  const body = (
    <>
      <span className={`flex size-10 items-center justify-center rounded-full ${tone}`}>{icon}</span>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">
        {money ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : value.toLocaleString()}
      </p>
    </>
  )
  const className = `${dashCardClass} block min-h-[148px] p-5 transition hover:shadow-md`
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}

function OverviewFunnel({ funnel }: { funnel: AdminFunnel | null | undefined }) {
  if (!funnel) return null
  const clientConv = funnel.booking_conversion_pct
  const companyAvg = funnel.company_avg_conversion_pct
  const belowAvg = clientConv != null && companyAvg != null && companyAvg - clientConv > 10
  const steps = [
    { label: 'Conversations', value: funnel.conversations, pct: null, tint: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
    { label: 'Booking-intent', value: funnel.booking_intent, pct: funnel.conv_to_intent_pct, tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
    { label: 'Booked', value: funnel.booked, pct: funnel.intent_to_booked_pct, tint: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300' },
    { label: 'Completed', value: funnel.completed, pct: funnel.booked_to_completed_pct, tint: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  ]
  return (
    <section className={`${dashCardClass} p-5`}>
      <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Company funnel (this month)</h3>
      <div className="mt-4 grid items-center gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-2.5">
          {steps.map((step) => (
            <div key={step.label} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${step.tint}`}>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                {step.pct != null ? <p className="text-xs opacity-80">{step.pct}% from prior</p> : null}
              </div>
              <p className="text-lg font-semibold tabular-nums">{step.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-50 px-5 py-5 dark:bg-zinc-800/40">
          <div>
            <p className="text-xs font-medium text-zinc-500">Booking conversion</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${belowAvg ? 'text-red-600' : 'text-zinc-950 dark:text-white'}`}>
              {clientConv == null ? '—' : `${clientConv}%`}
            </p>
            <p className="mt-4 text-xs font-medium text-zinc-500">Company average</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">
              {companyAvg == null ? '—' : `${companyAvg}%`}
            </p>
          </div>
          <ConversionRing pct={clientConv} />
        </div>
      </div>
    </section>
  )
}

function ConversionRing({ pct }: { pct: number | null }) {
  const shown = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dash = (shown / 100) * circumference
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 88 88" className="size-24 -rotate-90">
        <circle cx="44" cy="44" r={radius} fill="none" className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-semibold leading-tight text-blue-600">
        {pct == null ? '—' : `${pct}%`}
      </span>
    </div>
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

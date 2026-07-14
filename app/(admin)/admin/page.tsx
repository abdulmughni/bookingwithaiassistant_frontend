'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BanknotesIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/20/solid'

import { Button } from '@/components/button'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { AdminAlertPanel, FunnelBlock, HealthDot } from '@/components/admin/ops'
import { StatusBadge, formatDate } from '@/components/admin/shared'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AdminAlert } from '@/lib/types'

/** Session-only dashboard dismiss keys (not persisted). */
function alertKey(a: Pick<AdminAlert, 'tenant_id' | 'rule_key'>) {
  return `${a.tenant_id}:${a.rule_key}`
}

export default function AdminOverviewPage() {
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
      <PageHeader
        title="Overview"
        description="Platform-wide health: alerts, client statuses, and funnel."
      >
        <Button outline onClick={() => void refetch()}>
          Refresh
        </Button>
      </PageHeader>

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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total clients" value={data.tenants_total} href="/admin/clients" />
            <StatCard
              label="Active"
              value={data.tenants_active}
              href="/admin/clients?status=active"
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="Pending activation"
              value={data.tenants_pending}
              href="/admin/clients?status=pending"
              accent="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              label="Suspended"
              value={data.tenants_suspended}
              href="/admin/clients?status=suspended"
              accent="text-red-600 dark:text-red-400"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <TotalCard
              icon={<CalendarDaysIcon className="size-5" />}
              label="Bookings (all time)"
              value={data.bookings_total}
            />
            <TotalCard
              icon={<ChatBubbleLeftRightIcon className="size-5" />}
              label="Conversations"
              value={data.conversations_total}
            />
            <TotalCard
              icon={<PhoneIcon className="size-5" />}
              label="Calls"
              value={data.calls_total}
            />
            <TotalCard
              icon={<EnvelopeIcon className="size-5" />}
              label="Messages (30 days)"
              value={data.messages_30d}
            />
            <TotalCard
              icon={<BanknotesIcon className="size-5" />}
              label="$ recovered this month"
              value={data.recovered_value_this_month ?? 0}
              money
            />
          </div>

          <FunnelBlock funnel={data.funnel} title="Company funnel (this month)" />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={dashCardClass}>
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-700/80">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                  Recent sign-ups
                </h3>
                <Link
                  href="/admin/clients"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  View all
                </Link>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.recent_tenants.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-zinc-500">No clients yet.</li>
                )}
                {data.recent_tenants.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/clients/${encodeURIComponent(t.id)}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <HealthDot health={t.health ?? 'green'} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                            {t.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Joined {formatDate(t.created_at)}
                            {t.plan ? ` · ${t.plan.name}` : ' · No plan'}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={t.account_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className={dashCardClass}>
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-700/80">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                  Open plan requests
                  {data.open_plan_requests > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      {data.open_plan_requests}
                    </span>
                  )}
                </h3>
                <Link
                  href="/admin/requests"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  Manage
                </Link>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.recent_requests.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-zinc-500">
                    No open requests. All caught up.
                  </li>
                )}
                {data.recent_requests.map((r) => (
                  <li key={r.id} className="px-5 py-3">
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
                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </PageShell>
  )
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string
  value: number
  href: string
  accent?: string
}) {
  return (
    <Link
      href={href}
      className={`${dashCardClass} block p-5 transition-shadow hover:shadow-md`}
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${accent ?? 'text-zinc-950 dark:text-white'}`}
      >
        {value.toLocaleString()}
      </p>
    </Link>
  )
}

function TotalCard({
  icon,
  label,
  value,
  money,
}: {
  icon: React.ReactNode
  label: string
  value: number
  money?: boolean
}) {
  return (
    <div className={`${dashCardClass} flex items-center gap-4 p-5`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-zinc-950 dark:text-white">
          {money
            ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : value.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

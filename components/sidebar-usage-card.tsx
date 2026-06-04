'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'

import { useSubscription, useTenantTimezone } from '@/lib/hooks'
import type { QuotaState, Subscription } from '@/lib/types'

function formatRenewalDate(periodEndIso: string | null, timeZone: string): string {
  if (!periodEndIso) return ''
  const end = new Date(periodEndIso)
  if (Number.isNaN(end.getTime())) return ''
  const nowYear = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    timeZone,
  }).format(new Date())
  const endYear = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    timeZone,
  }).format(end)
  const opts: Intl.DateTimeFormatOptions =
    endYear === nowYear
      ? { month: 'short', day: 'numeric', timeZone }
      : { month: 'short', day: 'numeric', year: 'numeric', timeZone }
  return new Intl.DateTimeFormat(undefined, opts).format(end)
}

function formatRenewalLong(periodEndIso: string | null, timeZone: string): string {
  if (!periodEndIso) return ''
  const end = new Date(periodEndIso)
  if (Number.isNaN(end.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(end)
}

function stateFromPct(pct: number): QuotaState {
  if (pct >= 120) return 'blocked'
  if (pct >= 100) return 'over'
  if (pct >= 80) return 'warning'
  return 'ok'
}

function quotaStatusLabel(state: QuotaState): string {
  switch (state) {
    case 'blocked':
      return 'Blocked'
    case 'over':
      return 'Over limit'
    case 'warning':
      return 'Almost full'
    default:
      return 'On track'
  }
}

function barColor(state: QuotaState): string {
  switch (state) {
    case 'blocked':
    case 'over':
      return 'bg-red-500'
    case 'warning':
      return 'bg-amber-500'
    case 'no_plan':
      return 'bg-zinc-400'
    default:
      return 'bg-brand-500'
  }
}

function trackColor(state: QuotaState): string {
  switch (state) {
    case 'blocked':
    case 'over':
      return 'bg-red-100 dark:bg-red-950/50'
    case 'warning':
      return 'bg-amber-100 dark:bg-amber-950/40'
    default:
      return 'bg-brand-100 dark:bg-brand-950/40'
  }
}

export function SidebarUsageCard() {
  const { data, loading, refetch } = useSubscription()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  if (loading && !data) {
    return <PlanCardSkeleton />
  }

  if (!data || data.plan === null || data.usage.quota_state === 'no_plan') {
    return <NoPlanCard />
  }

  return (
    <ActivePlanCard
      subscription={data}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    />
  )
}

function PlanCardShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'mx-1 mb-1 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/90',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PlanCardSkeleton() {
  return (
    <PlanCardShell>
      <div className="space-y-3 p-3.5">
        <div className="h-4 w-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="h-9 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </PlanCardShell>
  )
}

function NoPlanCard() {
  return (
    <Link href="/plans" className="group mx-1 mb-1 block">
      <PlanCardShell className="border-dashed border-brand-300/90 bg-linear-to-br from-brand-50/90 to-white transition hover:border-brand-400 hover:shadow-md dark:border-brand-700/50 dark:from-brand-950/40 dark:to-zinc-900/90 dark:hover:border-brand-600">
        <div className="p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-b from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-500/25">
              <SparklesIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                Subscription
              </p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-white">
                Choose a plan
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Pick a tier to unlock customer messaging and AI voice minutes for this workspace.
              </p>
            </div>
          </div>
          <span className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2 text-xs font-semibold text-white transition group-hover:bg-brand-700">
            View plans
            <ArrowUpRightIcon className="size-3.5" />
          </span>
        </div>
      </PlanCardShell>
    </Link>
  )
}

function ActivePlanCard({
  subscription,
  onRefresh,
  refreshing,
}: {
  subscription: Subscription
  onRefresh: () => void
  refreshing: boolean
}) {
  const { plan, period_end, usage } = subscription
  const tenantTz = useTenantTimezone()
  if (!plan) return <NoPlanCard />

  const overallState = usage.quota_state
  const blocked = overallState === 'blocked'
  const over = overallState === 'over'
  const warning = overallState === 'warning'
  const stressed = blocked || over || warning

  const renewalLabel = formatRenewalDate(period_end, tenantTz)
  const renewalLongLabel = formatRenewalLong(period_end, tenantTz)

  return (
    <PlanCardShell
      className={clsx(
        blocked && 'border-red-300 dark:border-red-800/60',
        !blocked && stressed && 'border-amber-200 dark:border-amber-800/50',
      )}
    >
      {blocked && (
        <div className="border-b border-red-200/80 bg-red-50 px-3.5 py-2 text-xs leading-snug text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <span className="font-semibold">Outbound paused.</span> Usage is over your plan
          limit — upgrade to resume messages and calls.
        </div>
      )}

      {!blocked && over && (
        <div className="border-b border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          You are over quota. Upgrade soon to avoid blocked sends.
        </div>
      )}

      <div className="p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Your plan
        </p>

        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full items-center gap-1.5 rounded-xl bg-brand-50 px-2.5 py-1 ring-1 ring-brand-200/80 dark:bg-brand-950/50 dark:ring-brand-800/60">
              <span className="truncate text-sm font-semibold text-brand-800 dark:text-brand-200">
                {plan.name}
              </span>
              {plan.is_featured && (
                <span
                  title="Popular tier"
                  className="shrink-0 text-[10px] font-bold text-amber-500"
                  aria-hidden
                >
                  ★
                </span>
              )}
            </div>
            {renewalLabel ? (
              <p
                className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"
                title={renewalLongLabel || undefined}
              >
                Quota resets <span className="font-medium text-zinc-700 dark:text-zinc-300">{renewalLabel}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                30-day usage window
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh usage numbers"
            title="Refresh usage"
            className="shrink-0 rounded-lg border border-zinc-200/80 bg-zinc-50 p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <ArrowPathIcon className={clsx('size-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        <div className="mt-3 space-y-3 rounded-xl bg-zinc-50/80 p-2.5 ring-1 ring-zinc-950/5 dark:bg-zinc-800/40 dark:ring-white/5">
          <QuotaMeter
            icon={<ChatBubbleLeftRightIcon className="size-3.5" />}
            label="Messages"
            used={usage.messages_used}
            quota={plan.messages_quota}
            remaining={usage.messages_remaining}
            pct={usage.messages_pct}
          />
          <QuotaMeter
            icon={<PhoneIcon className="size-3.5" />}
            label="Voice minutes"
            used={usage.call_minutes_used}
            quota={plan.call_minutes_quota}
            remaining={usage.call_minutes_remaining}
            pct={usage.call_minutes_pct}
          />
        </div>

        <Link
          href="/plans"
          className={clsx(
            'mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition',
            blocked || over
              ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500'
              : warning
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500',
          )}
        >
          {blocked || over ? 'Upgrade plan' : 'Manage plan'}
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </div>
    </PlanCardShell>
  )
}

function QuotaMeter({
  icon,
  label,
  used,
  quota,
  remaining,
  pct,
}: {
  icon: ReactNode
  label: string
  used: number
  quota: number
  remaining: number
  pct: number
}) {
  const state = stateFromPct(pct)
  const clamped = Math.min(100, Math.max(0, pct))
  const displayPct = Math.round(pct)

  const helper =
    state === 'blocked' || state === 'over'
      ? `${Math.max(0, used - quota).toLocaleString()} over limit`
      : `${remaining.toLocaleString()} remaining`

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span className="text-brand-600 dark:text-brand-400">{icon}</span>
          {label}
        </span>
        <span
          className={clsx(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            state === 'blocked' || state === 'over'
              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
              : state === 'warning'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300',
          )}
        >
          {quotaStatusLabel(state)}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2 tabular-nums">
        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{displayPct}%</span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {used.toLocaleString()} / {quota.toLocaleString()}
        </span>
      </div>

      <div
        className={clsx('mt-1 h-2 w-full overflow-hidden rounded-full', trackColor(state))}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${displayPct}% used`}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor(state))}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{helper}</p>
    </div>
  )
}

'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { ArrowUpRightIcon, SparklesIcon } from '@heroicons/react/20/solid'

import { useSubscription } from '@/lib/hooks'
import type { QuotaState, Subscription } from '@/lib/types'

/**
 * Compact "what plan am I on / how much have I used" card pinned to the
 * bottom of the dashboard left sidebar.
 *
 * Three render modes:
 *
 *   1. Loading       — slim skeleton (avoids layout shift on first paint).
 *   2. No plan       — single CTA → /plans (matches the "leave them on no
 *                      plan until they pick" policy).
 *   3. Active plan   — plan badge, two usage bars (messages + call mins),
 *                      reset countdown, "Manage plan" link.
 *
 * The colour ramp on the bars exactly mirrors the backend ``quota_state``
 * (see ``api/services/usage.py``): blue under 80%, amber at 80–99%, red
 * at 100%+. The card adds a banner stripe at "blocked" so the operator
 * can't miss that outbound traffic is being refused by the backend gate.
 */
export function SidebarUsageCard() {
  const { data, loading } = useSubscription()

  if (loading && !data) {
    return (
      <div className="mx-1 mb-1 rounded-xl border border-zinc-200 bg-white/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-1.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-1.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    )
  }

  if (!data || data.plan === null || data.usage.quota_state === 'no_plan') {
    return <NoPlanCard />
  }

  return <ActivePlanCard subscription={data} />
}

// ---------------------------------------------------------------------------
// "No plan" CTA
// ---------------------------------------------------------------------------

function NoPlanCard() {
  return (
    <Link
      href="/plans"
      className={clsx(
        'group mx-1 mb-1 block rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 p-3',
        'transition hover:border-indigo-400 hover:bg-indigo-50',
        'dark:border-indigo-700/60 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <SparklesIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            Choose a plan
          </p>
          <p className="truncate text-xs text-indigo-700/80 dark:text-indigo-300/80">
            Unlock messaging and voice quotas
          </p>
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Active plan card
// ---------------------------------------------------------------------------

function ActivePlanCard({ subscription }: { subscription: Subscription }) {
  const { plan, period_end, usage } = subscription
  if (!plan) return <NoPlanCard />

  const state = usage.quota_state
  const blocked = state === 'blocked'
  const over = state === 'over'
  const warning = state === 'warning'

  return (
    <div
      className={clsx(
        'mx-1 mb-1 overflow-hidden rounded-xl border bg-white/70 shadow-sm dark:bg-zinc-900/60',
        blocked
          ? 'border-red-300 ring-1 ring-red-200 dark:border-red-700/60 dark:ring-red-800/40'
          : over
            ? 'border-red-200 dark:border-red-800/50'
            : warning
              ? 'border-amber-200 dark:border-amber-700/40'
              : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      {blocked && (
        <div className="bg-red-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Quota blocked — upgrade
        </div>
      )}

      <div className="px-3 py-2.5">
        {/* Plan name + featured ★ */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {plan.name}
            </span>
            {plan.is_featured && (
              <span
                title="Featured tier"
                className="text-amber-500 dark:text-amber-400"
              >
                ★
              </span>
            )}
          </div>
          <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatPeriodHint(period_end)}
          </span>
        </div>

        {/* Bars */}
        <div className="mt-2.5 space-y-2">
          <UsageBar
            label="Messages"
            used={usage.messages_used}
            quota={plan.messages_quota}
            remaining={usage.messages_remaining}
            pct={usage.messages_pct}
          />
          <UsageBar
            label="Call mins"
            used={usage.call_minutes_used}
            quota={plan.call_minutes_quota}
            remaining={usage.call_minutes_remaining}
            pct={usage.call_minutes_pct}
          />
        </div>

        <Link
          href="/plans"
          className={clsx(
            'mt-2.5 inline-flex items-center gap-1 text-xs font-medium',
            blocked || over
              ? 'text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200'
              : warning
                ? 'text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200'
                : 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200',
          )}
        >
          {blocked || over ? 'Upgrade plan' : 'Manage plan'}
          <ArrowUpRightIcon className="size-3" />
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function UsageBar({
  label,
  used,
  quota,
  remaining,
  pct,
}: {
  label: string
  used: number
  quota: number
  remaining: number
  pct: number
}) {
  const state = stateFromPct(pct)
  const clamped = Math.min(100, Math.max(0, pct))

  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px] tabular-nums">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-zinc-700 dark:text-zinc-300">
          {used.toLocaleString()} / {quota.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={clsx('h-full transition-all', barColor(state))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-500">
        {state === 'blocked' || state === 'over'
          ? `Over by ${Math.max(0, used - quota).toLocaleString()}`
          : `${remaining.toLocaleString()} left`}
      </div>
    </div>
  )
}

function stateFromPct(pct: number): QuotaState {
  if (pct >= 120) return 'blocked'
  if (pct >= 100) return 'over'
  if (pct >= 80) return 'warning'
  return 'ok'
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
    case 'ok':
    default:
      return 'bg-indigo-500'
  }
}

function formatPeriodHint(periodEndIso: string | null): string {
  if (!periodEndIso) return ''
  const end = new Date(periodEndIso)
  if (Number.isNaN(end.getTime())) return ''
  const now = new Date()
  const msLeft = end.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
  if (daysLeft <= 0) return 'Resetting…'
  if (daysLeft === 1) return 'Resets in 1d'
  return `Resets in ${daysLeft}d`
}

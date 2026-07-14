'use client'

import clsx from 'clsx'
import Link from 'next/link'

import type { AdminAlert, AdminFunnel } from '@/lib/types'

export function HealthDot({
  health = 'green',
  size = 'sm',
  className,
}: {
  health?: 'red' | 'yellow' | 'green'
  size?: 'sm' | 'md'
  className?: string
}) {
  const tone =
    health === 'red'
      ? 'bg-red-500'
      : health === 'yellow'
        ? 'bg-amber-400'
        : 'bg-emerald-500'
  return (
    <span
      title={health.toUpperCase()}
      className={clsx(
        'inline-block shrink-0 rounded-full',
        size === 'md' ? 'size-3' : 'size-2.5',
        tone,
        className,
      )}
      aria-label={`Health ${health}`}
    />
  )
}

function formatSince(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function AdminAlertPanel({
  alerts,
  onDismiss,
}: {
  alerts: AdminAlert[]
  onDismiss?: (alert: AdminAlert) => void
}) {
  if (!alerts.length) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        All clients healthy
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Needs action today ({alerts.length})
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Dismiss hides here for this session only — still visible on the client page.
        </p>
      </header>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {alerts.map((a) => {
          const key = `${a.tenant_id}:${a.rule_key}`
          return (
            <li
              key={key}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <HealthDot health={a.severity} />
              <Link
                href={`/admin/clients/${encodeURIComponent(a.tenant_id)}`}
                className="font-medium text-sky-700 hover:underline dark:text-sky-300"
              >
                {a.tenant_name}
              </Link>
              <span className="min-w-0 flex-1 text-zinc-600 dark:text-zinc-300">
                {a.reason}
              </span>
              <span className="shrink-0 text-xs text-zinc-400">
                since {formatSince(a.since)}
              </span>
              {onDismiss ? (
                <button
                  type="button"
                  onClick={() => onDismiss(a)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Dismiss
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function pctLabel(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v}%`
}

export function FunnelBlock({
  funnel,
  period,
  onPeriodChange,
  title = 'Booking funnel',
}: {
  funnel: AdminFunnel | null | undefined
  period?: 'week' | 'month' | 'all'
  onPeriodChange?: (p: 'week' | 'month' | 'all') => void
  title?: string
}) {
  if (!funnel) return null

  const clientConv = funnel.booking_conversion_pct
  const companyAvg = funnel.company_avg_conversion_pct
  const belowAvg =
    clientConv != null &&
    companyAvg != null &&
    companyAvg - clientConv > 10

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h3>
        {onPeriodChange && period ? (
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
            {(['week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-medium capitalize',
                  period === p
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                )}
              >
                {p === 'week' ? 'This week' : p === 'month' ? 'This month' : 'All time'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FunnelStep label="Conversations" value={funnel.conversations} />
        <FunnelStep
          label="Booking-intent"
          value={funnel.booking_intent}
          pct={funnel.conv_to_intent_pct}
        />
        <FunnelStep
          label="Booked"
          value={funnel.booked}
          pct={funnel.intent_to_booked_pct}
        />
        <FunnelStep
          label="Completed"
          value={funnel.completed}
          pct={funnel.booked_to_completed_pct}
        />
      </div>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Booking conversion:{' '}
        <span className={clsx('font-semibold', belowAvg && 'text-red-600 dark:text-red-400')}>
          {pctLabel(clientConv)}
        </span>
        {companyAvg != null ? (
          <>
            {' '}
            · Company average: <span className="font-semibold">{pctLabel(companyAvg)}</span>
          </>
        ) : null}
      </p>
    </section>
  )
}

function FunnelStep({
  label,
  value,
  pct,
}: {
  label: string
  value: number
  pct?: number | null
}) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-950/50">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
        {value.toLocaleString()}
      </p>
      {pct != null ? (
        <p className="mt-0.5 text-xs text-zinc-400">{pct}% from prior</p>
      ) : null}
    </div>
  )
}

/** Map DB booking status → admin outcome label. */
export const BOOKING_OUTCOME_LABEL: Record<string, string> = {
  confirmed: 'UPCOMING',
  rescheduled: 'UPCOMING',
  completed: 'COMPLETED',
  no_show: 'NO-SHOW',
  cancelled: 'CANCELLED',
}

export const BOOKING_STATUS_OPTIONS = [
  { value: 'confirmed', label: 'UPCOMING' },
  { value: 'completed', label: 'COMPLETED' },
  { value: 'no_show', label: 'NO-SHOW' },
  { value: 'cancelled', label: 'CANCELLED' },
  { value: 'rescheduled', label: 'UPCOMING (rescheduled)' },
]

export function relativeActivity(iso: string | null | undefined): {
  label: string
  stale: boolean
} {
  if (!iso) return { label: 'Never', stale: true }
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return { label: '—', stale: false }
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 60) return { label: `${Math.max(1, mins)}m ago`, stale: false }
  const hours = Math.round(mins / 60)
  if (hours < 48) return { label: `${hours}h ago`, stale: hours > 24 }
  const days = Math.round(hours / 24)
  return { label: `${days}d ago`, stale: true }
}

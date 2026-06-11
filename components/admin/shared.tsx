'use client'

import clsx from 'clsx'

import { Badge } from '@/components/badge'
import type { AccountStatus } from '@/lib/types'

export const STATUS_COLOR: Record<AccountStatus, 'green' | 'amber' | 'red'> = {
  active: 'green',
  pending: 'amber',
  suspended: 'red',
}

export const STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
}

/** Compact usage progress bar: green → amber (≥80%) → red (≥100%). */
export function UsageBar({
  used,
  quota,
  label,
  className,
}: {
  used: number
  quota: number
  label: string
  className?: string
}) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
  const tone =
    quota <= 0
      ? 'bg-zinc-300 dark:bg-zinc-600'
      : pct >= 100
        ? 'bg-red-500'
        : pct >= 80
          ? 'bg-amber-500'
          : 'bg-emerald-500'
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-300">
          {used.toLocaleString()} / {quota > 0 ? quota.toLocaleString() : '—'}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={clsx('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

/** One-time price of a prepaid credit pack, e.g. "$199". */
export function priceLabel(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/** Human validity window, e.g. "180 days" or "~6 months". */
export function validityLabel(days: number): string {
  if (!days || days <= 0) return '—'
  if (days % 30 === 0) {
    const months = days / 30
    return `${days} days (~${months} mo)`
  }
  return `${days} days`
}

const INDUSTRY_LABEL: Record<string, string> = {
  hvac: 'HVAC only',
  plumbing: 'Plumbing only',
  electrical: 'Electrical only',
  field_service: 'Field service (multi-trade)',
  general: 'Field service (multi-trade)',
}

/** Human-readable industry label from tenant industry_type slug. */
export function formatIndustryLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  const key = raw === 'general' ? 'field_service' : raw
  return INDUSTRY_LABEL[key] ?? raw.replace(/_/g, ' ')
}

'use client'

import { useId, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/20/solid'

import { dashCardClass } from '@/components/dashboard-ui'

function smoothLine(points: { x: number; y: number }[]) {
  if (points.length === 0) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]
    const current = points[index]
    const next = points[index + 1]
    const after = points[index + 2] ?? next
    const control1x = current.x + (next.x - previous.x) / 6
    const control1y = current.y + (next.y - previous.y) / 6
    const control2x = next.x - (after.x - current.x) / 6
    const control2y = next.y - (after.y - current.y) / 6
    path += ` C ${control1x} ${control1y}, ${control2x} ${control2y}, ${next.x} ${next.y}`
  }
  return path
}

/** Real counts, grouped so a long daily series draws as one smooth wave. */
function wavePoints(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (clean.length <= 16) return clean
  const buckets = 12
  const size = clean.length / buckets
  const points: number[] = []
  for (let index = 0; index < buckets; index += 1) {
    const start = Math.floor(index * size)
    const end = Math.max(start + 1, Math.floor((index + 1) * size))
    let sum = 0
    for (let cursor = start; cursor < end && cursor < clean.length; cursor += 1) sum += clean[cursor]
    points.push(sum)
  }
  return points
}

export function AreaSparkline({
  values,
  color,
  compact = false,
}: {
  values: number[]
  color: string
  compact?: boolean
}) {
  const width = compact ? 96 : 360
  const height = compact ? 32 : 84
  const gradientId = useId().replace(/:/g, '')
  const series = wavePoints(values)
  if (series.length < 2) return null
  const max = Math.max(...series)
  const min = Math.min(...series)
  const span = max - min || 1
  const step = width / (series.length - 1)
  const top = compact ? 3 : 6
  const bottom = compact ? 3 : 1
  const coords = series.map((value, index) => ({
    x: index * step,
    y: height - bottom - ((value - min) / span) * (height - top - bottom),
  }))
  const line = smoothLine(coords)
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={compact ? 'h-8 w-24' : 'block h-16 w-full'} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="55%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiStatCard({
  label,
  value,
  trend,
  trendTone = 'up',
  icon,
  tone,
  stroke,
  series,
  href,
}: {
  label: string
  value: ReactNode
  trend?: string | null
  trendTone?: 'up' | 'down' | 'flat'
  icon: ReactNode
  tone: string
  stroke: string
  series: number[]
  href?: string
}) {
  const trendClass = trendTone === 'down' ? 'text-rose-500' : trendTone === 'flat' ? 'text-zinc-400' : 'text-emerald-500'
  const body = (
    <>
      <div className="relative z-10 flex items-start gap-3 pr-2">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-500">{label}</p>
          <p className="mt-1 text-[1.65rem] font-semibold leading-none tracking-tight text-zinc-950">{value}</p>
          <p className={`mt-2 flex min-h-4 items-center gap-1 text-xs font-medium ${trendClass}`}>
            {trend ? (
              <>
                {trendTone === 'down' ? <ArrowDownIcon className="size-3" /> : null}
                {trendTone === 'up' ? <ArrowUpIcon className="size-3" /> : null}
                {trend}
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <AreaSparkline values={series} color={stroke} />
      </div>
    </>
  )
  const className = `${dashCardClass} relative flex h-full min-h-[148px] flex-col overflow-hidden rounded-[20px] p-4 pb-16 transition hover:-translate-y-0.5 hover:shadow-md motion-safe:duration-200`
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  }
  return <article className={className}>{body}</article>
}

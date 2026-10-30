'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { ChevronUpIcon } from '@heroicons/react/20/solid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { dashCardClass } from '@/components/dashboard-ui'

export interface ActivityPoint {
  date: string
  bookings: number
  calls: number
  messages: number
}

const SERIES = [
  { key: 'bookings', name: 'Bookings', fill: '#1d4ed8' },
  { key: 'calls', name: 'Calls', fill: '#60a5fa' },
  { key: 'messages', name: 'Messages', fill: '#93c5fd' },
] as const

const PREMIUM_SERIES = [
  { key: 'bookings', name: 'Bookings', fill: '#6d89a8' },
  { key: 'calls', name: 'Calls', fill: '#8aafb8' },
  { key: 'messages', name: 'Messages', fill: '#b7a9c8' },
] as const

function monthKey(date: string) {
  return date.slice(0, 7)
}

function axisLabel(date: string, monthly: boolean) {
  const parsed = new Date(`${date.length === 7 ? `${date}-01` : date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', monthly ? { month: 'short' } : { month: 'short', day: 'numeric' })
}

function bucket(points: ActivityPoint[]) {
  if (points.length <= 45) {
    return points.map((point) => ({
      label: axisLabel(point.date, false),
      bookings: point.bookings,
      calls: point.calls,
      messages: point.messages,
    }))
  }
  const months = new Map<string, { label: string; bookings: number; calls: number; messages: number }>()
  for (const point of points) {
    const key = monthKey(point.date)
    const current = months.get(key) ?? { label: axisLabel(key, true), bookings: 0, calls: 0, messages: 0 }
    current.bookings += point.bookings
    current.calls += point.calls
    current.messages += point.messages
    months.set(key, current)
  }
  return [...months.values()]
}

export function ActivityBars({
  title,
  subtitle,
  points,
  menu,
  loading,
  variant = 'default',
  minimized = false,
  onToggleMinimize,
}: {
  title: string
  subtitle: string
  points: ActivityPoint[]
  menu?: ReactNode
  loading?: boolean
  /** Agency home uses thicker pastel bars. Admin keeps the default chart. */
  variant?: 'default' | 'premium'
  minimized?: boolean
  onToggleMinimize?: () => void
}) {
  const totals = points.reduce(
    (sum, point) => ({
      bookings: sum.bookings + point.bookings,
      calls: sum.calls + point.calls,
      messages: sum.messages + point.messages,
    }),
    { bookings: 0, calls: 0, messages: 0 },
  )
  const data = bucket(points)
  const tickEvery = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0
  const series = variant === 'premium' ? PREMIUM_SERIES : SERIES
  const barSize = variant === 'premium' ? 15 : 16

  return (
    <section className={`${dashCardClass} flex h-full flex-col rounded-[18px] p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-zinc-950 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-sm leading-5 text-zinc-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {minimized ? null : menu}
          {onToggleMinimize ? (
            <CollapseControl minimized={minimized} label={title} onClick={onToggleMinimize} />
          ) : null}
        </div>
      </div>
      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${variant === 'premium' && !minimized ? 'justify-center' : 'justify-start'}`}>
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-2 rounded-full" style={{ background: item.fill }} />
            {item.name}
            <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
              {totals[item.key].toLocaleString()}
            </span>
          </span>
        ))}
      </div>
      <div
        className={clsx(
          'grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
          minimized ? 'grid-rows-[0fr] opacity-0' : 'mt-1 grid-rows-[1fr] opacity-100',
        )}
      >
        <div className="overflow-hidden">
      {loading ? (
        <div className={`mt-4 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800 ${variant === 'premium' ? 'h-52' : 'h-72'}`} />
      ) : (
        <div className={`mt-2 w-full min-w-0 ${variant === 'premium' ? 'h-52' : 'h-72'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              barCategoryGap={variant === 'premium' ? '46%' : '42%'}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid stroke="#eef0f2" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickEvery}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                cursor={{ fill: 'rgba(109, 137, 168, 0.08)' }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
              />
              <Bar dataKey="bookings" name="Bookings" stackId="day" fill={series[0].fill} maxBarSize={barSize} />
              <Bar dataKey="calls" name="Calls" stackId="day" fill={series[1].fill} maxBarSize={barSize} />
              <Bar
                dataKey="messages"
                name="Messages"
                stackId="day"
                fill={series[2].fill}
                radius={variant === 'premium' ? [4, 4, 0, 0] : [6, 6, 0, 0]}
                maxBarSize={barSize}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
        </div>
      </div>
    </section>
  )
}

export function CollapseControl({
  minimized,
  label,
  onClick,
}: {
  minimized: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={minimized ? `Restore ${label}` : `Minimize ${label}`}
      title={minimized ? 'Expand' : 'Minimize'}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/90 transition duration-200 hover:bg-blue-600 hover:text-white hover:ring-blue-600"
    >
      <ChevronUpIcon className={clsx('size-4 transition-transform duration-300', minimized && 'rotate-180')} />
    </button>
  )
}

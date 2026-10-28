'use client'

import type { ReactNode } from 'react'
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
}: {
  title: string
  subtitle: string
  points: ActivityPoint[]
  menu?: ReactNode
  loading?: boolean
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

  return (
    <section className={`${dashCardClass} flex h-full flex-col p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
        </div>
        {menu}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        {SERIES.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-2 rounded-full" style={{ background: item.fill }} />
            {item.name}
            <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
              {totals[item.key].toLocaleString()}
            </span>
          </span>
        ))}
      </div>
      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <div className="mt-2 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="42%" margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#ececef" vertical={false} />
              <XAxis
                dataKey="label"
                interval={tickEvery}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }}
              />
              <Bar dataKey="bookings" name="Bookings" stackId="day" fill="#1d4ed8" maxBarSize={16} />
              <Bar dataKey="calls" name="Calls" stackId="day" fill="#60a5fa" maxBarSize={16} />
              <Bar dataKey="messages" name="Messages" stackId="day" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

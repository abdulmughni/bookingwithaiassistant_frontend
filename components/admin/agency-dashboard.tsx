'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { StatusBadge, formatDateTime } from '@/components/admin/shared'
import { dashCardClass } from '@/components/dashboard-ui'
import type { AdminTenant, AgencyActivity, AgencyActivityEvent } from '@/lib/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function minutesRemaining(client: AdminTenant) {
  const quota = client.usage?.call_minutes_quota ?? 0
  if (quota <= 0) return 0
  return Math.max(0, quota - (client.usage?.call_minutes_used ?? 0))
}

export function messagesRemaining(client: AdminTenant) {
  if (client.plan?.messages_unlimited) return null
  const quota = client.usage?.messages_quota ?? 0
  if (quota <= 0) return 0
  return Math.max(0, quota - (client.usage?.messages_used ?? 0))
}

export function attentionReason(client: AdminTenant, now = Date.now()) {
  if (client.account_status === 'suspended') return 'Suspended'
  if (client.account_status === 'pending') return 'Pending activation'
  if (client.usage?.quota_state === 'no_plan') return 'No credit pack'
  if (client.is_expired || client.usage?.quota_state === 'expired') return 'Credit pack expired'
  if (client.usage?.quota_state === 'over') return 'Credits exhausted'
  if (client.usage?.quota_state === 'warning') return 'Credits running low'
  if (!client.last_activity_at) return 'No activity in 7 days'
  const at = new Date(client.last_activity_at).getTime()
  if (Number.isNaN(at) || now - at > WEEK_MS) return 'No activity in 7 days'
  return null
}

function chartDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso.slice(5)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function DashboardTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <p className="font-medium text-zinc-950 dark:text-white">{label ? chartDate(String(label)) : ''}</p>
      {payload.map((item) => (
        <p key={item.name} className="mt-1 text-zinc-600 dark:text-zinc-300">
          <span className="mr-1 inline-block size-2 rounded-sm" style={{ background: item.color }} />
          {item.name}: {item.value ?? 0}
        </p>
      ))}
    </div>
  )
}

export function AgencyRangeChart({
  series,
  variant = 'simple',
  lightName = 'Bookings',
  darkName = 'Calls',
  yMax,
}: {
  series: AgencyActivity['series']
  variant?: 'simple' | 'dashboard'
  lightName?: string
  darkName?: string
  yMax?: number
}) {
  const data = series.map((point) => ({
    ...point,
    label: point.date.slice(5),
    light: point.bookings,
    dark: point.calls,
  }))
  if (variant === 'dashboard') {
    return (
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="38%" margin={{ top: 28, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#ececef" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={chartDate}
              interval={2}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              domain={yMax ? [0, yMax] : [0, 'auto']}
              ticks={yMax ? [0, 10, 20, 30, 40] : undefined}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<DashboardTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
            <Legend
              verticalAlign="top"
              align="center"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: '#71717a', top: 0 }}
            />
            <Bar dataKey="light" name={lightName} stackId="day" fill="#93c5fd" maxBarSize={16} />
            <Bar dataKey="dark" name={darkName} stackId="day" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="bookings" name="Bookings" fill="#3b59ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ClientPerformanceTable({
  clients,
  counts,
}: {
  clients: AdminTenant[]
  counts: Map<string, { bookings: number; calls: number; messages: number }>
}) {
  if (clients.length === 0) {
    return <p className="text-sm text-zinc-500">No clients yet. Invite one from My Clients.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-2 py-2 font-medium">Client</th>
            <th className="px-2 py-2 font-medium">Bookings</th>
            <th className="px-2 py-2 font-medium">Calls</th>
            <th className="px-2 py-2 font-medium">Messages</th>
            <th className="px-2 py-2 font-medium">Pack</th>
            <th className="px-2 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const count = counts.get(client.id)
            return (
              <tr key={client.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-3 font-medium">
                  <Link
                    href={`/admin/clients/${encodeURIComponent(client.id)}`}
                    className="text-zinc-950 hover:text-brand-700 dark:text-white"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-2 py-3 tabular-nums">{count?.bookings ?? client.bookings_this_month ?? 0}</td>
                <td className="px-2 py-3 tabular-nums">{count?.calls ?? '—'}</td>
                <td className="px-2 py-3 tabular-nums">{count?.messages ?? client.usage?.messages_used ?? 0}</td>
                <td className="px-2 py-3">{client.plan?.name ?? 'No pack'}</td>
                <td className="px-2 py-3">
                  <StatusBadge status={client.account_status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RecentActivityList({ events }: { events: AgencyActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500">No activity yet.</p>
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {events.map((event) => (
        <li key={`${event.kind}-${event.tenant_id}-${event.at}`}>
          <Link
            href={`/admin/clients/${encodeURIComponent(event.tenant_id)}`}
            className="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <span className="min-w-0">
              <span className="font-medium text-zinc-950 dark:text-white">{event.title}</span>
              <span className="mt-0.5 block truncate text-zinc-500">{event.tenant_name}</span>
            </span>
            <span className="shrink-0 text-zinc-500">{formatDateTime(event.at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function DashboardCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className={`${dashCardClass} p-5`}>
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

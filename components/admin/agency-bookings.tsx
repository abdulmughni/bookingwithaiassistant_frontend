'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { ChannelIcon, type SourceChannel } from '@/components/channel-icon'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AdminBookingRow, AdminTenant, AgencyActivityClient } from '@/lib/types'

type Row = AdminBookingRow & { tenant_id: string }

const SOURCE_FILTERS = [
  { id: 'all', label: 'All sources' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'call', label: 'Phone call' },
  { id: 'other', label: 'Other' },
] as const

const STATUS_FILTERS = [
  { id: 'all', label: 'All clients' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'suspended', label: 'Suspended' },
] as const

function sourceName(channel: string) {
  const value = channel.toLowerCase()
  if (value === 'facebook') return 'Facebook'
  if (value === 'instagram') return 'Instagram'
  if (value === 'call') return 'Phone call'
  if (value === 'whatsapp') return 'WhatsApp'
  if (value === 'web') return 'Web chat'
  if (value === 'api') return 'Added in the app'
  return channel || 'Unknown'
}

function statusName(status: string) {
  if (status === 'no_show') return 'No-show'
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function accountLabel(status: string) {
  if (status === 'active') return 'Active'
  if (status === 'pending') return 'Pending'
  if (status === 'suspended') return 'Suspended'
  return status
}

function whenLabel(row: Row) {
  const raw = row.selected_slot || row.created_at
  if (!raw) return 'Time not set'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return 'Time not set'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function matchesSource(channel: string, filter: string) {
  const value = (channel || '').toLowerCase()
  if (filter === 'all') return true
  if (filter === 'other') return value !== 'facebook' && value !== 'instagram' && value !== 'call'
  return value === filter
}

function quotaTone(state: string) {
  if (state === 'ok') return 'bg-emerald-500'
  if (state === 'warning') return 'bg-amber-500'
  return 'bg-red-500'
}

function quotaLabel(state: string) {
  if (state === 'ok') return 'Healthy'
  if (state === 'warning') return 'Running low'
  if (state === 'over') return 'Used up'
  if (state === 'expired') return 'Expired'
  if (state === 'blocked') return 'Blocked'
  if (state === 'no_plan') return 'No pack'
  return state
}

export function AgencyBookings() {
  const [clientQuery, setClientQuery] = useState('')
  const [account, setAccount] = useState<(typeof STATUS_FILTERS)[number]['id']>('all')
  const [source, setSource] = useState<(typeof SOURCE_FILTERS)[number]['id']>('all')
  const query = useApiData(async (token) => {
    const clients = await api.admin.listTenants(token)
    let activity: AgencyActivityClient[] = []
    try {
      const report = await api.admin.agencyActivity(token, 30)
      activity = report.clients
    } catch {
      activity = []
    }
    const lists = await Promise.all(
      clients.map(async (client) => {
        try {
          const rows = await api.admin.listTenantBookings(token, client.id, 200)
          return rows.map((row) => ({ ...row, tenant_id: client.id }))
        } catch {
          return [] as Row[]
        }
      }),
    )
    return { clients, bookings: lists.flat(), activity }
  }, [])

  const clients = query.data?.clients ?? []
  const bookings = query.data?.bookings ?? []
  const activity = query.data?.activity ?? []

  const visibleClients = useMemo(() => {
    const needle = clientQuery.trim().toLowerCase()
    return clients
      .filter((client) => account === 'all' || client.account_status === account)
      .filter((client) => !needle || client.name.toLowerCase().includes(needle))
      .sort((a, b) => (b.last_activity_at || '').localeCompare(a.last_activity_at || '') || a.name.localeCompare(b.name))
  }, [account, clientQuery, clients])

  const groups = useMemo(() => {
    return visibleClients
      .map((client) => ({
        client,
        recent: activity.find((row) => row.tenant_id === client.id),
        rows: bookings
          .filter((row) => row.tenant_id === client.id && matchesSource(row.source_channel, source))
          .sort((a, b) => (b.selected_slot || b.created_at || '').localeCompare(a.selected_slot || a.created_at || '')),
      }))
      .filter((group) => source === 'all' || group.rows.length > 0)
  }, [activity, bookings, source, visibleClients])

  const totals = useMemo(() => {
    const rows = groups.flatMap((group) => group.rows)
    return {
      clients: groups.length,
      bookings: rows.length,
      open: rows.filter((row) => row.status === 'confirmed' || row.status === 'rescheduled').length,
      done: rows.filter((row) => row.status === 'completed').length,
      facebook: rows.filter((row) => row.source_channel.toLowerCase() === 'facebook').length,
      instagram: rows.filter((row) => row.source_channel.toLowerCase() === 'instagram').length,
      call: rows.filter((row) => row.source_channel.toLowerCase() === 'call').length,
    }
  }, [groups])

  return (
    <PageShell>
      <PageHeader
        title="Bookings"
        description="Check each client in order: whether they are live, how much of their pack is left, where jobs came from, then the jobs themselves."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Clients in view" value={totals.clients} />
        <Summary label="Bookings" value={totals.bookings} />
        <Summary label="Still open" value={totals.open} />
        <Summary label="Completed" value={totals.done} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Facebook" value={totals.facebook} />
        <Summary label="Instagram" value={totals.instagram} />
        <Summary label="Phone calls" value={totals.call} />
      </div>

      <div className={`${dashCardClass} grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]`}>
        <label className="text-sm">
          <span className="text-zinc-500">Find a client</span>
          <Input className="mt-1" value={clientQuery} placeholder="Client name" onChange={(event) => setClientQuery(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Account</span>
          <Select className="mt-1" aria-label="Account" value={account} onChange={(event) => setAccount(event.target.value as typeof account)}>
            {STATUS_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Where it was booked</span>
          <Select className="mt-1" aria-label="Where it was booked" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
            {SOURCE_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {query.loading ? <SkeletonBlock className="h-48" /> : null}
      {query.error ? <p className="text-sm text-red-600">{query.error}</p> : null}
      {!query.loading && clients.length === 0 ? (
        <p className="text-sm text-zinc-500">No clients yet. Invite one from Clients.</p>
      ) : null}
      {!query.loading && groups.length === 0 && clients.length > 0 ? (
        <p className="text-sm text-zinc-500">No clients match this view.</p>
      ) : null}

      {groups.map((group) => (
        <ClientProgress key={group.client.id} client={group.client} rows={group.rows} recent={group.recent} />
      ))}
    </PageShell>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${dashCardClass} px-4 py-3`}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
    </div>
  )
}

function ClientProgress({
  client,
  rows,
  recent,
}: {
  client: AdminTenant
  rows: Row[]
  recent: AgencyActivityClient | undefined
}) {
  const [open, setOpen] = useState(false)
  const shown = open ? rows : rows.slice(0, 4)
  const counts = {
    facebook: rows.filter((row) => row.source_channel.toLowerCase() === 'facebook').length,
    instagram: rows.filter((row) => row.source_channel.toLowerCase() === 'instagram').length,
    call: rows.filter((row) => row.source_channel.toLowerCase() === 'call').length,
  }
  const usage = client.usage
  const minutesPct = usage && usage.call_minutes_quota > 0 ? Math.min(100, Math.round((usage.call_minutes_used / usage.call_minutes_quota) * 100)) : 0
  const messagesPct = usage && usage.messages_quota > 0 ? Math.min(100, Math.round((usage.messages_used / usage.messages_quota) * 100)) : 0

  return (
    <section className={`${dashCardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-700/80">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">{client.name}</h2>
            <span className={accountClass(client.account_status)}>{accountLabel(client.account_status)}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {quotaLabel(usage?.quota_state || 'no_plan')}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {client.plan?.name || 'No pack assigned'}
            {client.subscription_expires_at ? ` · through ${new Date(client.subscription_expires_at).toLocaleDateString()}` : ''}
          </p>
        </div>
        <Link href={`/admin/clients/${client.id}`} className="text-sm font-medium text-blue-600">
          Open client
        </Link>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Bookings" value={client.bookings_count} hint="All time" />
        <Fact label="Conversations" value={client.conversations_count} hint="All time" />
        <Fact label="Calls" value={recent?.calls ?? 0} hint="Last 30 days" />
        <Fact label="Messages" value={recent?.messages ?? 0} hint="Last 30 days" />
      </div>

      <div className="grid gap-4 px-5 pb-4 md:grid-cols-2">
        <Meter label="Call minutes" used={usage?.call_minutes_used ?? 0} quota={usage?.call_minutes_quota ?? 0} pct={minutesPct} tone={quotaTone(usage?.quota_state || 'no_plan')} />
        <Meter label="Messages in the pack" used={usage?.messages_used ?? 0} quota={usage?.messages_quota ?? 0} pct={messagesPct} tone={quotaTone(usage?.quota_state || 'no_plan')} />
      </div>

      <div className="flex flex-wrap gap-2 px-5 pb-4 text-sm">
        <SourceCount channel="facebook" label="Facebook" count={counts.facebook} />
        <SourceCount channel="instagram" label="Instagram" count={counts.instagram} />
        <SourceCount channel="call" label="Phone call" count={counts.call} />
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-zinc-100 px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800">No bookings yet.</p>
      ) : (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Booked from</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-5 py-3 font-medium text-zinc-950 dark:text-white">{row.customer_name || 'Unknown customer'}</td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300">{row.service_type || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">{whenLabel(row)}</td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300">{statusName(row.status)}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                        <ChannelIcon channel={row.source_channel as SourceChannel} className="size-4" colored />
                        {sourceName(row.source_channel)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 4 ? (
            <div className="px-5 py-3">
              <button type="button" className="text-sm font-medium text-blue-600" onClick={() => setOpen((value) => !value)}>
                {open ? 'Show fewer' : `Show all ${rows.length}`}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function accountClass(status: string) {
  const base = 'rounded-full px-2 py-0.5 text-xs font-medium'
  if (status === 'active') return `${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`
  if (status === 'pending') return `${base} bg-amber-400/20 text-amber-800 dark:text-amber-200`
  if (status === 'suspended') return `${base} bg-red-500/15 text-red-700 dark:text-red-300`
  return `${base} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`
}

function Fact({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-white/5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{value.toLocaleString()}</p>
      <p className="text-[11px] text-zinc-500">{hint}</p>
    </div>
  )
}

function Meter({
  label,
  used,
  quota,
  pct,
  tone,
}: {
  label: string
  used: number
  quota: number
  pct: number
  tone: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {used.toLocaleString()} / {quota > 0 ? quota.toLocaleString() : '—'}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/15">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${quota > 0 ? pct : 0}%` }} />
      </div>
    </div>
  )
}

function SourceCount({ channel, label, count }: { channel: SourceChannel; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 dark:bg-white/5">
      <ChannelIcon channel={channel} className="size-4" colored />
      <span className="text-zinc-700 dark:text-zinc-200">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-950 dark:text-white">{count}</span>
    </span>
  )
}

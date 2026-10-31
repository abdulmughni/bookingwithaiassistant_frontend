'use client'

import { useMemo, useState } from 'react'

import { ChannelIcon, type SourceChannel } from '@/components/channel-icon'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { Select } from '@/components/select'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AdminBookingRow, AdminTenant } from '@/lib/types'

type Row = AdminBookingRow & { tenant_id: string; tenant_name: string }

const SOURCE_FILTERS = [
  { id: 'all', label: 'All sources' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'call', label: 'Phone call' },
  { id: 'other', label: 'Other' },
] as const

function sourceName(channel: string) {
  const value = channel.toLowerCase()
  if (value === 'facebook') return 'Facebook'
  if (value === 'instagram') return 'Instagram'
  if (value === 'call') return 'Phone call'
  if (value === 'whatsapp') return 'WhatsApp'
  if (value === 'web') return 'Web chat'
  if (value === 'api') return 'Added in the app'
  return channel ? channel : 'Unknown'
}

function statusName(status: string) {
  if (status === 'no_show') return 'No-show'
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
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

export function AgencyBookings() {
  const [clientId, setClientId] = useState('all')
  const [source, setSource] = useState<(typeof SOURCE_FILTERS)[number]['id']>('all')
  const query = useApiData(async (token) => {
    const clients = await api.admin.listTenants(token)
    const lists = await Promise.all(
      clients.map(async (client) => {
        const rows = await api.admin.listTenantBookings(token, client.id, 200)
        return rows.map((row) => ({ ...row, tenant_id: client.id, tenant_name: client.name }))
      }),
    )
    return { clients, bookings: lists.flat() }
  }, [])

  const clients = query.data?.clients ?? []
  const bookings = query.data?.bookings ?? []
  const forClient = useMemo(
    () => bookings.filter((row) => clientId === 'all' || row.tenant_id === clientId),
    [bookings, clientId],
  )
  const visible = useMemo(
    () => forClient.filter((row) => matchesSource(row.source_channel, source)),
    [forClient, source],
  )
  const groups = useMemo(() => {
    const chosen = clientId === 'all' ? clients : clients.filter((client) => client.id === clientId)
    return chosen
      .map((client) => ({
        client,
        rows: visible
          .filter((row) => row.tenant_id === client.id)
          .sort((a, b) => (b.selected_slot || b.created_at || '').localeCompare(a.selected_slot || a.created_at || '')),
      }))
      .filter((group) => source === 'all' || group.rows.length > 0)
  }, [clients, clientId, source, visible])

  const counts = {
    facebook: forClient.filter((row) => row.source_channel.toLowerCase() === 'facebook').length,
    instagram: forClient.filter((row) => row.source_channel.toLowerCase() === 'instagram').length,
    call: forClient.filter((row) => row.source_channel.toLowerCase() === 'call').length,
  }

  return (
    <PageShell>
      <PageHeader
        title="Bookings"
        description="Jobs booked for each of your clients, and whether they came from Facebook, Instagram, or a phone call."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Facebook" value={counts.facebook} />
        <Summary label="Instagram" value={counts.instagram} />
        <Summary label="Phone calls" value={counts.call} />
      </div>

      <div className={`${dashCardClass} flex flex-wrap items-end gap-3 p-4`}>
        <label className="min-w-48 flex-1 text-sm">
          <span className="text-zinc-500">Client</span>
          <Select className="mt-1" aria-label="Client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-44 text-sm">
          <span className="text-zinc-500">Where it was booked</span>
          <Select
            className="mt-1"
            aria-label="Where it was booked"
            value={source}
            onChange={(event) => setSource(event.target.value as (typeof SOURCE_FILTERS)[number]['id'])}
          >
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
        <p className="text-sm text-zinc-500">No bookings match this view.</p>
      ) : null}

      {groups.map((group) => (
        <ClientBookings key={group.client.id} client={group.client} rows={group.rows} />
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

function ClientBookings({ client, rows }: { client: AdminTenant; rows: Row[] }) {
  return (
    <section className={`${dashCardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-700/80">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">{client.name}</h2>
        <p className="text-sm text-zinc-500">{rows.length === 1 ? '1 booking' : `${rows.length} bookings`}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500">No bookings yet.</p>
      ) : (
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
              {rows.map((row) => (
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
      )}
    </section>
  )
}

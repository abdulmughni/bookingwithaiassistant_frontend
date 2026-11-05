'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'

import { StatusBadge, UsageBar, formatDate, formatDateTime as formatStamp, formatIndustryLabel } from '@/components/admin/shared'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { ChannelIcon, SourceBadge, channelLabel } from '@/components/channel-icon'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { Dialog, DialogBody, DialogTitle } from '@/components/dialog'
import { TenantConfigTab } from '@/app/(dashboard)/settings/page'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken } from '@/lib/hooks'
import { formatDateTime, statusColor } from '@/lib/utils'
import type { AdminConversationDetail, AdminConversationRow, BookingDetails } from '@/lib/types'

type TabId = 'details' | 'bookings' | 'conversations' | 'profile' | 'configuration'

const TABS: { id: TabId; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'conversations', label: 'Recent conversations' },
  { id: 'profile', label: 'Company profile' },
  { id: 'configuration', label: 'Configuration' },
]

function prettyStatus(status: string) {
  if (status === 'no_show') return 'No-show'
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function packHealth(state: string) {
  if (state === 'ok') return 'Healthy'
  if (state === 'warning') return 'Running low'
  if (state === 'over') return 'Used up'
  if (state === 'expired') return 'Expired'
  if (state === 'blocked') return 'Blocked'
  if (state === 'no_plan') return 'No pack'
  return state
}

function crmLabel(value: string | null | undefined) {
  if (!value || value === 'none') return 'Not connected'
  if (value === 'google_calendar') return 'Google Calendar'
  if (value === 'jobber') return 'Jobber'
  if (value === 'hubspot') return 'HubSpot'
  return value
}

export function AgencyClientProfile() {
  const params = useParams<{ id: string }>()
  const tenantId = decodeURIComponent(params.id)
  const getToken = useApiToken()
  const [tab, setTab] = useState<TabId>('details')
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const detail = useApiData((token) => api.admin.getTenant(token, tenantId), [tenantId])
  const bookings = useApiData((token) => api.admin.listTenantBookings(token, tenantId, 200), [tenantId])
  const conversations = useApiData(
    (token) => api.admin.listTenantConversations(token, tenantId, { limit: 100 }),
    [tenantId],
  )

  async function suspend() {
    try {
      const token = await getToken()
      await api.admin.suspend(token, tenantId)
      toast.success('Client suspended')
      await detail.refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not suspend this client.')
    }
  }

  if (detail.loading && !detail.data) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }
  if (detail.error || !detail.data) {
    return <p className="text-sm text-red-600">{detail.error || 'Could not load this client.'}</p>
  }
  const client = detail.data
  const zone = client.timezone || 'UTC'

  return (
    <PageShell>
      <Link href="/admin/clients" className="text-sm text-zinc-500 hover:text-zinc-800">
        All clients
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{client.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatIndustryLabel(client.industry_type)} · {client.plan?.name ?? 'No credit pack'} · {packHealth(client.usage.quota_state)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={client.account_status} />
          {client.account_status === 'active' ? (
            <Button outline onClick={() => void suspend()}>
              Suspend
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800" role="tablist">
        {TABS.map((item) => {
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-600 transition dark:text-zinc-300 ${
                selected ? 'view-switch-on' : 'hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === 'details' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Bookings" value={client.bookings_count} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" icon={<CalendarDaysIcon className="size-5" />} />
            <StatCard label="Calls" value={client.calls_count} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" icon={<PhoneIcon className="size-5" />} />
            <StatCard label="Conversations" value={client.conversations_count} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" icon={<ChatBubbleLeftRightIcon className="size-5" />} />
          </div>

          <section className={`${dashCardClass} p-4`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageBar used={client.usage.call_minutes_used} quota={client.usage.call_minutes_quota} label="Minutes" />
              <UsageBar
                used={client.usage.messages_used}
                quota={client.plan?.messages_unlimited ? 0 : client.usage.messages_quota}
                label={client.plan?.messages_unlimited ? 'Messages (unlimited)' : 'Messages'}
              />
            </div>
          </section>

          <section className={`${dashCardClass} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3`}>
            <Fact label="Credit pack" value={client.plan?.name ?? 'No pack assigned'} />
            <Fact label="Pack through" value={client.subscription_expires_at ? formatDate(client.subscription_expires_at) : '—'} />
            <Fact label="Timezone" value={zone} />
            <Fact label="Last activity" value={formatStamp(client.last_activity_at)} />
            <Fact label="Calendar" value={crmLabel(client.crm_type)} />
            <Fact
              label="Channels"
              value={
                (client.channels ?? []).length === 0 ? (
                  'None connected'
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {(client.channels ?? []).map((channel) => (
                      <span key={channel} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                        <ChannelIcon channel={channel} className="size-3.5" colored />
                        {channelLabel(channel)}
                      </span>
                    ))}
                  </span>
                )
              }
            />
          </section>
        </>
      ) : null}

      {tab === 'bookings' ? (
        <section className={`${dashCardClass} overflow-hidden`}>
          {bookings.loading ? <p className="px-5 py-4 text-sm text-zinc-500">Loading…</p> : null}
          {bookings.error ? <p className="px-5 py-4 text-sm text-red-600">{bookings.error}</p> : null}
          {!bookings.loading && (bookings.data?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
                  <tr>
                    <th className="w-[22%] px-4 py-3">Customer</th>
                    <th className="w-[22%] px-3 py-3">Scheduled</th>
                    <th className="w-[26%] px-3 py-3">Service</th>
                    <th className="w-[16%] px-3 py-3">Source</th>
                    <th className="w-[14%] px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookings.data ?? []).map((booking) => (
                    <tr
                      key={booking.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setBookingId(booking.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setBookingId(booking.id)
                        }
                      }}
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3">
                        <p className="truncate font-semibold text-zinc-950 dark:text-white">{booking.customer_name}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{booking.customer_phone || '—'}</p>
                      </td>
                      <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200">
                        {booking.selected_slot ? formatDateTime(booking.selected_slot, zone) : 'Time not set'}
                      </td>
                      <td className="px-3 py-3">
                        <p className="line-clamp-2 text-zinc-800 dark:text-zinc-200">{booking.service_type || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <SourceBadge channel={booking.source_channel} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={statusColor(booking.status)}>{prettyStatus(booking.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'conversations' ? (
        <section className={`${dashCardClass} overflow-hidden`}>
          {conversations.loading ? <p className="px-5 py-4 text-sm text-zinc-500">Loading…</p> : null}
          {conversations.error ? <p className="px-5 py-4 text-sm text-red-600">{conversations.error}</p> : null}
          {!conversations.loading && (conversations.data?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">No conversations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
                  <tr>
                    <th className="w-[28%] px-4 py-3">Customer</th>
                    <th className="w-[16%] px-3 py-3">Channel</th>
                    <th className="w-[18%] px-3 py-3">Outcome</th>
                    <th className="w-[18%] px-3 py-3">Intent</th>
                    <th className="w-[20%] px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(conversations.data ?? []).map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setConversationId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setConversationId(row.id)
                        }
                      }}
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3">
                        <p className="truncate font-semibold text-zinc-950 dark:text-white">
                          {row.customer_display_name || row.customer_label_name || 'Unknown customer'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{row.customer_phone || row.channel_account_label || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                          <ChannelIcon channel={row.channel} className="size-4" colored />
                          {channelLabel(row.channel)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <OutcomeBadge outcome={row.outcome} />
                      </td>
                      <td className="px-3 py-3 capitalize text-zinc-600 dark:text-zinc-300">{row.intent_category || '—'}</td>
                      <td className="px-4 py-3 text-zinc-500">{formatStamp(row.updated_at || row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'profile' || tab === 'configuration' ? (
        <section className={`${dashCardClass} p-5`}>
          <BusinessSettings tenantId={tenantId} part={tab === 'profile' ? 'profile' : 'configuration'} />
        </section>
      ) : null}

      <BookingReadout tenantId={tenantId} bookingId={bookingId} zone={zone} onClose={() => setBookingId(null)} />
      <ConversationReadout tenantId={tenantId} conversationId={conversationId} onClose={() => setConversationId(null)} />
    </PageShell>
  )
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: string
  icon: React.ReactNode
}) {
  return (
    <div className={`${dashCardClass} flex items-center gap-3 rounded-2xl px-4 py-3`}>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-white/5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-white">{value}</div>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: AdminConversationRow['outcome'] }) {
  const color = outcome === 'BOOKED' ? 'green' : outcome === 'ESCALATED' ? 'amber' : 'zinc'
  const label = outcome === 'NO BOOKING' ? 'No booking' : outcome === 'BOOKED' ? 'Booked' : 'Escalated'
  return <Badge color={color}>{label}</Badge>
}

function BookingReadout({
  tenantId,
  bookingId,
  zone,
  onClose,
}: {
  tenantId: string
  bookingId: string | null
  zone: string
  onClose: () => void
}) {
  const getToken = useApiToken()
  const [data, setData] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookingId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const token = await getToken()
        const row = await api.admin.getTenantBooking(token, tenantId, bookingId)
        if (!cancelled) setData(row)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this booking.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookingId, getToken, tenantId])

  return (
    <Dialog open={Boolean(bookingId)} onClose={onClose} size="3xl">
      <DialogTitle>{data?.customer_name || 'Booking'}</DialogTitle>
      <DialogBody>
        {loading && !data ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={statusColor(data.status)}>{prettyStatus(data.status)}</Badge>
              <SourceBadge channel={data.source_channel} />
              <span className="text-xs text-zinc-500">Created {formatDateTime(data.created_at, zone)}</span>
            </div>
            <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                <SparklesIcon className="size-4" />
                Booking summary
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                {data.chat_summary?.trim() || data.notes?.trim() || 'No summary was saved for this booking.'}
              </p>
            </section>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Tile icon={ClockIcon} label="Scheduled">{data.selected_slot ? formatDateTime(data.selected_slot, zone) : '—'}</Tile>
              <Tile icon={WrenchScrewdriverIcon} label="Service">{data.service_type || '—'}</Tile>
              <Tile icon={PhoneIcon} label="Phone"><span className="font-mono text-[13px]">{data.customer_phone || '—'}</span></Tile>
              <Tile icon={MapPinIcon} label="Address">{data.customer_address || '—'}</Tile>
              <Tile icon={ChatBubbleLeftRightIcon} label="Conversation">
                {data.conversation_channel ? channelLabel(data.conversation_channel) : 'No linked chat'}
                {data.conversation_intent ? <span className="mt-1 block text-xs font-normal text-zinc-500">Intent: {data.conversation_intent}</span> : null}
              </Tile>
              <Tile icon={ClockIcon} label="Last update">{formatDateTime(data.updated_at, zone)}</Tile>
            </div>
            {data.call ? (
              <section className="rounded-xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Linked voice call</p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                  {data.call.duration_seconds ? `${Math.floor(data.call.duration_seconds / 60)}m ${String(data.call.duration_seconds % 60).padStart(2, '0')}s` : 'Duration not recorded'}
                  {data.call.started_at ? ` · ${formatDateTime(data.call.started_at, zone)}` : ''}
                </p>
                {data.call.summary ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-100">{data.call.summary}</p> : null}
              </section>
            ) : null}
            {data.status_note ? (
              <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-white/5 dark:text-zinc-200">{data.status_note}</p>
            ) : null}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-700">
              <p className="border-b border-zinc-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                Recent messages{data.messages.length > 0 ? ` · ${data.messages.length}` : ''}
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
                {data.messages.length === 0 ? (
                  <p className="text-sm text-zinc-500">This booking is not linked to a chat.</p>
                ) : (
                  data.messages.map((message) => {
                    const fromCustomer = message.role === 'user'
                    return (
                      <p
                        key={message.id}
                        className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          fromCustomer
                            ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                            : 'ml-auto bg-blue-600 text-white'
                        }`}
                      >
                        {message.content || '—'}
                      </p>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function ConversationReadout({
  tenantId,
  conversationId,
  onClose,
}: {
  tenantId: string
  conversationId: string | null
  onClose: () => void
}) {
  const getToken = useApiToken()
  const [data, setData] = useState<AdminConversationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const token = await getToken()
        const row = await api.admin.getTenantConversation(token, tenantId, conversationId)
        if (!cancelled) setData(row)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this conversation.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationId, getToken, tenantId])

  const name = data?.customer_display_name || data?.customer_label_name || 'Conversation'

  return (
    <Dialog open={Boolean(conversationId)} onClose={onClose} size="3xl">
      <DialogTitle>{name}</DialogTitle>
      <DialogBody>
        {loading && !data ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                <ChannelIcon channel={data.channel} className="size-4" colored />
                {channelLabel(data.channel)}
              </span>
              <OutcomeBadge outcome={data.outcome} />
              <span className="text-xs text-zinc-500">{data.turn_count ?? 0} turns</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile icon={PhoneIcon} label="Phone">{data.customer_phone || '—'}</Tile>
              <Tile icon={SparklesIcon} label="Intent">{data.intent_category || '—'}</Tile>
              <Tile icon={ChatBubbleLeftRightIcon} label="Account">{data.channel_account_label || '—'}</Tile>
              <Tile icon={CalendarDaysIcon} label="Linked booking">{data.booking_id || 'None'}</Tile>
            </div>
            {data.escalation_reason ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{data.escalation_reason}</p>
            ) : null}
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-700">
              <p className="border-b border-zinc-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                Messages{data.messages.length > 0 ? ` · ${data.messages.length}` : ''}
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
                {data.messages.length === 0 ? (
                  <p className="text-sm text-zinc-500">No messages stored for this conversation.</p>
                ) : (
                  data.messages.map((message) => {
                    const fromCustomer = message.role === 'user'
                    return (
                      <p
                        key={message.id}
                        className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          fromCustomer
                            ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                            : 'ml-auto bg-blue-600 text-white'
                        }`}
                      >
                        {message.content || '—'}
                      </p>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function Tile({ icon: Icon, label, children }: { icon: typeof PhoneIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-white/5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-white">{children}</div>
    </div>
  )
}

function BusinessSettings({ tenantId, part }: { tenantId: string; part: 'profile' | 'configuration' }) {
  const getToken = useApiToken()
  const { data, loading, error, refetch } = useApiData(
    (token) => api.admin.getTenantSettings(token, tenantId),
    [tenantId],
  )
  const saveSettings = useCallback(
    (token: string, body: Record<string, unknown>) => api.admin.updateTenantSettings(token, tenantId, body),
    [tenantId],
  )
  const loadTimezones = useCallback(
    (token: string) => api.admin.listTenantTimezones(token, tenantId),
    [tenantId],
  )
  if (loading && !data) return <SkeletonBlock className="h-40" />
  if (error || !data) return <p className="text-sm text-red-600">{error || 'Could not load the profile.'}</p>
  return (
    <TenantConfigTab
      mode="customer"
      part={part}
      tenant={data}
      credentials={[]}
      onSaved={() => void refetch()}
      saveSettings={saveSettings}
      loadTimezones={loadTimezones}
      weeklyReportEnabled={data.weekly_report_enabled !== false}
      onWeeklyReportChange={async (enabled) => {
        const token = await getToken()
        await api.admin.setWeeklyReportEnabled(token, tenantId, enabled)
      }}
    />
  )
}

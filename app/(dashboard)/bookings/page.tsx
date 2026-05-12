'use client'

import { useState } from 'react'
import {
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Divider } from '@/components/divider'
import { Card, CardBody } from '@/components/card'
import {
  BookingStatusDialog,
  type BookingAction,
} from '@/components/booking-status-dialog'
import { BookingDetailsDialog } from '@/components/booking-details-dialog'
import { SourceBadge } from '@/components/channel-icon'
import { useApiData, useApiToken, useTenantTimezone } from '@/lib/hooks'
import { api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime, statusColor } from '@/lib/utils'
import type { Booking } from '@/lib/types'

type SchedulingState = 'overdue' | 'today' | 'upcoming' | 'past' | 'unknown'

interface SchedulingMeta {
  state: SchedulingState
  dayKey: string | null
}

const ACTIVE_STATUSES = new Set(['confirmed', 'rescheduled'])

/** Calendar date key (YYYY-MM-DD) in the requested IANA timezone — used so
 *  "overdue / today / upcoming" reflect the tenant's clock regardless of where
 *  the operator's browser is. ``timeZone`` is the tenant's IANA name. */
function dayKeyInTz(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function getSchedulingMeta(
  booking: Booking,
  timeZone: string,
  now: Date = new Date(),
): SchedulingMeta {
  const iso = booking.selected_slot
  if (!iso) return { state: 'unknown', dayKey: null }
  const slot = new Date(iso)
  if (Number.isNaN(slot.getTime())) return { state: 'unknown', dayKey: null }

  const dayKey = dayKeyInTz(slot, timeZone)
  const todayKey = dayKeyInTz(now, timeZone)

  // Past/completed/cancelled bookings just render as "past" — we don't shout
  // about overdue when an operator already resolved the booking.
  const stillActive = ACTIVE_STATUSES.has(booking.status)

  if (dayKey < todayKey) {
    return { state: stillActive ? 'overdue' : 'past', dayKey }
  }
  if (dayKey === todayKey) {
    // Today, but already finished slot in the past 30 minutes still counts as today.
    return { state: 'today', dayKey }
  }
  return { state: 'upcoming', dayKey }
}

function ScheduleBadge({ meta }: { meta: SchedulingMeta }) {
  if (meta.state === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
        <ExclamationTriangleIcon className="h-3 w-3" aria-hidden="true" />
        Date passed — needs follow-up
      </span>
    )
  }
  if (meta.state === 'today') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        Time is coming · today
      </span>
    )
  }
  return null
}

function ScheduledLine({
  booking,
  meta,
  timeZone,
}: {
  booking: Booking
  meta: SchedulingMeta
  timeZone: string
}) {
  const text = booking.selected_slot
    ? formatDateTime(booking.selected_slot, timeZone)
    : '—'
  if (meta.state === 'overdue') {
    return <span className="font-semibold text-red-600 dark:text-red-400">{text}</span>
  }
  if (meta.state === 'today') {
    return <span className="font-semibold text-amber-600 dark:text-amber-400">{text}</span>
  }
  return <span className="font-medium text-zinc-800 dark:text-zinc-200">{text}</span>
}

interface ActiveActionState {
  booking: Booking
  action: BookingAction
}

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [phoneSearch, setPhoneSearch] = useState('')
  const [scheduleDateFrom, setScheduleDateFrom] = useState('')
  const [scheduleDateTo, setScheduleDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'box' | 'list'>('box')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [activeAction, setActiveAction] = useState<ActiveActionState | null>(null)
  const getToken = useApiToken()
  const tenantTz = useTenantTimezone()

  const { data: bookings, loading, refetch } = useApiData<Booking[]>(
    (token) => api.bookings.list(token, statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  )

  const submitAction = async (booking: Booking, action: BookingAction, note: string) => {
    try {
      const token = await getToken()
      const trimmed = note.trim() || undefined
      if (action === 'cancel') {
        await api.bookings.cancel(token, booking.id, trimmed)
        notifySuccess('Booking cancelled')
      } else if (action === 'complete') {
        await api.bookings.complete(token, booking.id, trimmed)
        notifySuccess('Marked as completed')
      } else {
        await api.bookings.noShow(token, booking.id, trimmed)
        notifySuccess('Marked as no-show')
      }
      setActiveAction(null)
      setSelectedBooking(null)
      refetch()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const displayBookings = bookings ?? []

  const matchesScheduleRange = (booking: Booking) => {
    if (!scheduleDateFrom && !scheduleDateTo) return true
    const meta = getSchedulingMeta(booking, tenantTz)
    if (!meta.dayKey) return false
    if (scheduleDateFrom && meta.dayKey < scheduleDateFrom) return false
    if (scheduleDateTo && meta.dayKey > scheduleDateTo) return false
    return true
  }
  const matchesSearch = (booking: Booking) => {
    const q = phoneSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (booking.customer_phone || '').toLowerCase().includes(q) ||
      (booking.source_contact || '').toLowerCase().includes(q) ||
      (booking.customer_name || '').toLowerCase().includes(q)
    )
  }
  const filteredBookings = displayBookings.filter(
    (booking) => matchesScheduleRange(booking) && matchesSearch(booking),
  )
  const hasActiveFilters = Boolean(
    phoneSearch || scheduleDateFrom || scheduleDateTo || statusFilter,
  )

  // Counts are cheap (typically tens of items) — no memoization needed and the
  // React Compiler handles the rest.
  let overdueCount = 0
  let todayCount = 0
  for (const b of displayBookings) {
    const s = getSchedulingMeta(b, tenantTz).state
    if (s === 'overdue') overdueCount++
    else if (s === 'today') todayCount++
  }

  const prettyStatus = (s: string) => s.replace('_', ' ')

  /** Stop card-level click from triggering when the operator hits an action button. */
  const stopBubble = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
  }
  const openDetails = (booking: Booking) => setSelectedBooking(booking)
  const openAction = (booking: Booking, action: BookingAction) =>
    setActiveAction({ booking, action })

  const renderActionButtons = (booking: Booking) => (
    <>
      <Button
        plain
        className="text-xs"
        onClick={(e) => {
          stopBubble(e)
          openAction(booking, 'complete')
        }}
      >
        Complete
      </Button>
      <Button
        plain
        className="text-xs"
        onClick={(e) => {
          stopBubble(e)
          openAction(booking, 'no-show')
        }}
      >
        No-show
      </Button>
      <Button
        plain
        className="text-xs text-red-600 dark:text-red-400"
        onClick={(e) => {
          stopBubble(e)
          openAction(booking, 'cancel')
        }}
      >
        Cancel
      </Button>
    </>
  )

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Bookings</Heading>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Click any booking for the full summary, conversation, and call recording when
            available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
              <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
              {overdueCount} overdue
            </span>
          )}
          {todayCount > 0 && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
              <SparklesIcon className="h-4 w-4" aria-hidden="true" />
              {todayCount} today
            </span>
          )}
        </div>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
            }}
          >
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No show</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search by phone..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Scheduled from
            </label>
            <Input
              type="date"
              value={scheduleDateFrom}
              onChange={(e) => setScheduleDateFrom(e.target.value)}
              title="Appointment on or after this date"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Scheduled to
            </label>
            <Input
              type="date"
              value={scheduleDateTo}
              onChange={(e) => setScheduleDateTo(e.target.value)}
              title="Appointment on or before this date"
            />
          </div>
          {(() => {
            const today = dayKeyInTz(new Date(), tenantTz)
            const isTodayActive = scheduleDateFrom === today && scheduleDateTo === today
            return (
              <Button
                plain
                aria-pressed={isTodayActive}
                title={
                  isTodayActive
                    ? 'Clear the today filter'
                    : 'Show only bookings scheduled for today'
                }
                className={`text-xs ${
                  isTodayActive
                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/40'
                    : ''
                }`}
                onClick={() => {
                  if (isTodayActive) {
                    setScheduleDateFrom('')
                    setScheduleDateTo('')
                  } else {
                    setScheduleDateFrom(today)
                    setScheduleDateTo(today)
                  }
                }}
              >
                {isTodayActive ? 'Showing today ✓' : 'Today'}
              </Button>
            )
          })()}
        </div>
        {hasActiveFilters && (
          <Button
            plain
            onClick={() => {
              setStatusFilter('')
              setPhoneSearch('')
              setScheduleDateFrom('')
              setScheduleDateTo('')
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          <Button
            plain
            className={`px-3 py-1 text-xs ${viewMode === 'box' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            onClick={() => setViewMode('box')}
          >
            Box view
          </Button>
          <Button
            plain
            className={`px-3 py-1 text-xs ${viewMode === 'list' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List view
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : filteredBookings.length > 0 ? (
          <div key={viewMode} className="bookings-layout-animate">
            {viewMode === 'box' ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBookings.map((booking) => {
                  const meta = getSchedulingMeta(booking, tenantTz)
                  const cardTone =
                    meta.state === 'overdue'
                      ? 'border-red-300 bg-red-50/40 dark:border-red-500/40 dark:bg-red-500/5'
                      : meta.state === 'today'
                        ? 'border-amber-300 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-500/5'
                        : 'border-zinc-200 dark:border-zinc-700'
                  return (
                    <Card
                      key={booking.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetails(booking)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openDetails(booking)
                        }
                      }}
                      className={`cursor-pointer border shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:border-zinc-600 ${cardTone}`}
                    >
                      <CardBody className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-zinc-950 dark:text-white">
                              {booking.customer_name}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                              {booking.customer_phone}
                            </p>
                          </div>
                          <Badge color={statusColor(booking.status)}>
                            {prettyStatus(booking.status)}
                          </Badge>
                        </div>
                        <div className="-mt-2 flex flex-wrap items-center gap-2">
                          <ScheduleBadge meta={meta} />
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Created {formatDateTime(booking.created_at, tenantTz)}
                          </span>
                        </div>

                        <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/70">
                          <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Service
                            </span>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {booking.service_type}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Scheduled
                            </span>
                            <ScheduledLine booking={booking} meta={meta} timeZone={tenantTz} />
                          </div>
                          <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Source
                            </span>
                            <SourceBadge channel={booking.source_channel} />
                          </div>
                          {(booking.source_channel.toLowerCase() === 'call' ||
                            booking.source_channel.toLowerCase() === 'api') && (
                            <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {booking.source_channel.toLowerCase() === 'call'
                                  ? 'Vapi number'
                                  : 'Created from'}
                              </span>
                              <span className="font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                {booking.source_contact || booking.customer_phone || '—'}
                              </span>
                            </div>
                          )}
                        </div>

                        {ACTIVE_STATUSES.has(booking.status) && (
                          <div className="flex flex-wrap gap-2">{renderActionButtons(booking)}</div>
                        )}

                        {booking.status_note && (
                          <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 italic dark:bg-zinc-800/60 dark:text-zinc-300">
                            “{booking.status_note}”
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className="hidden rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 xl:grid xl:grid-cols-[minmax(8rem,1.35fr)_minmax(7rem,1fr)_minmax(6rem,1fr)_auto_auto_minmax(8rem,1.15fr)_minmax(7rem,auto)] xl:gap-4"
                  aria-hidden
                >
                  <span>Customer</span>
                  <span>Scheduled</span>
                  <span>Service</span>
                  <span className="text-center">Source</span>
                  <span className="text-center">From</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                {filteredBookings.map((booking) => {
                  const meta = getSchedulingMeta(booking, tenantTz)
                  const rowTone =
                    meta.state === 'overdue'
                      ? 'border-red-300 bg-red-50/40 dark:border-red-500/40 dark:bg-red-500/5'
                      : meta.state === 'today'
                        ? 'border-amber-300 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-500/5'
                        : 'border-zinc-200 dark:border-zinc-700'
                  return (
                    <Card
                      key={booking.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetails(booking)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openDetails(booking)
                        }
                      }}
                      className={`cursor-pointer border shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:border-zinc-600 ${rowTone}`}
                    >
                      <CardBody className="p-0">
                        <div className="flex flex-col gap-3 p-4 xl:grid xl:grid-cols-[minmax(8rem,1.35fr)_minmax(7rem,1fr)_minmax(6rem,1fr)_auto_auto_minmax(8rem,1.15fr)_minmax(7rem,auto)] xl:items-center xl:gap-4 xl:p-3">
                          <div className="min-w-0 xl:border-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                              Customer
                            </p>
                            <p className="truncate font-semibold text-zinc-950 dark:text-white">
                              {booking.customer_name}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                              {booking.customer_phone}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                              Scheduled
                            </p>
                            <p className="whitespace-nowrap text-sm">
                              <ScheduledLine booking={booking} meta={meta} timeZone={tenantTz} />
                            </p>
                            {(meta.state === 'overdue' || meta.state === 'today') && (
                              <div className="mt-1">
                                <ScheduleBadge meta={meta} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                              Service
                            </p>
                            <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                              {booking.service_type}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 xl:justify-center">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                              Source
                            </span>
                            <SourceBadge channel={booking.source_channel} />
                          </div>
                          <div className="min-w-0 xl:text-center">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                              {booking.source_channel.toLowerCase() === 'call' ? 'Vapi number' : 'From'}
                            </p>
                            <p className="truncate font-mono text-xs text-zinc-800 dark:text-zinc-200">
                              {booking.source_contact || booking.customer_phone || '—'}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                              Status
                            </p>
                            <div className="flex flex-col items-start gap-1 xl:items-stretch">
                              <Badge color={statusColor(booking.status)}>
                                {prettyStatus(booking.status)}
                              </Badge>
                              <span className="max-w-56 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                                Created {formatDateTime(booking.created_at, tenantTz)}
                                <br />
                                Updated {formatDateTime(booking.updated_at, tenantTz)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 border-t border-zinc-100 pt-3 xl:justify-end xl:border-t-0 xl:pt-0 dark:border-zinc-800">
                            {ACTIVE_STATUSES.has(booking.status) && renderActionButtons(booking)}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {hasActiveFilters ? 'No bookings found for selected filters' : 'No bookings yet'}
          </p>
        )}
      </div>

      <BookingDetailsDialog
        open={selectedBooking !== null}
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />

      <BookingStatusDialog
        open={activeAction !== null}
        action={activeAction?.action ?? 'complete'}
        customerName={activeAction?.booking.customer_name}
        onClose={() => setActiveAction(null)}
        onConfirm={async (note) => {
          if (!activeAction) return
          await submitAction(activeAction.booking, activeAction.action, note)
        }}
      />
    </>
  )
}

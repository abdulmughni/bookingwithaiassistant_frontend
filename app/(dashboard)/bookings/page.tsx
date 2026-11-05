'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/button'
import { FilterPanel, PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Card, CardBody } from '@/components/card'
import {
  BookingStatusDialog,
  type BookingAction,
} from '@/components/booking-status-dialog'
import { BookingDetailsDialog } from '@/components/booking-details-dialog'
import { BookingFormDialog } from '@/components/booking-form-dialog'
import { BookingsCalendar } from '@/components/bookings-calendar'
import { HoverIconActions } from '@/components/hover-icon-actions'
import { SourceBadge } from '@/components/channel-icon'
import { useApiData, useApiToken, useTenantTimezone } from '@/lib/hooks'
import { api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { slotDurationMinutesFromBuffers } from '@/lib/booking-calendar'
import { decodeBookingId } from '@/lib/booking-link'
import { formatDateTime, statusColor } from '@/lib/utils'
import type { Booking, Tenant } from '@/lib/types'

type PageTab = 'calendar' | 'list'
type LayoutMode = 'box' | 'list'

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

  const stillActive = ACTIVE_STATUSES.has(booking.status)

  if (dayKey < todayKey) {
    return { state: stillActive ? 'overdue' : 'past', dayKey }
  }
  if (dayKey === todayKey) {
    return { state: 'today', dayKey }
  }
  return { state: 'upcoming', dayKey }
}

function ScheduleBadge({ meta }: { meta: SchedulingMeta }) {
  if (meta.state === 'overdue') {
    return (
      <span className="inline-flex max-w-full items-center gap-1 whitespace-normal rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
        <ExclamationTriangleIcon className="h-3 w-3" aria-hidden="true" />
        Date passed — needs follow-up
      </span>
    )
  }
  if (meta.state === 'today') {
    return (
      <span className="inline-flex max-w-full items-center gap-1 whitespace-normal rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-3">
      <span className="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="min-w-0 text-right text-sm font-medium break-words text-zinc-800 dark:text-zinc-100">
        {children}
      </div>
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? '' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
      style={
        active
          ? {
              backgroundColor: 'color-mix(in srgb, var(--brand-primary, #2563eb) 16%, white)',
              color: 'var(--brand-primary, #1d4ed8)',
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}

interface ActiveActionState {
  booking: Booking
  action: BookingAction
}

interface FormState {
  mode: 'create' | 'edit'
  booking?: Booking | null
  initialSlot?: string | null
}

const BOOKING_STATUSES = ['confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show']

function BookingsPageInner() {
  const [phoneSearch, setPhoneSearch] = useState('')
  const [scheduleDateFrom, setScheduleDateFrom] = useState('')
  const [scheduleDateTo, setScheduleDateTo] = useState('')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('box')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [activeAction, setActiveAction] = useState<ActiveActionState | null>(null)
  const [formState, setFormState] = useState<FormState | null>(null)
  const getToken = useApiToken()
  const tenantTz = useTenantTimezone()
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkedRef = useRef<string | null>(null)
  const statusFromUrl = searchParams.get('status') || ''
  const statusFilter = BOOKING_STATUSES.includes(statusFromUrl) ? statusFromUrl : ''

  const setStatusFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('status', value)
    else params.delete('status')
    const q = params.toString()
    router.replace(q ? `/bookings?${q}` : '/bookings', { scroll: false })
  }

  const pageTab: PageTab =
    searchParams.get('view') === 'calendar' ? 'calendar' : 'list'

  const setPageTab = (tab: PageTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'list') params.delete('view')
    else params.set('view', tab)
    const q = params.toString()
    router.replace(q ? `/bookings?${q}` : '/bookings', { scroll: false })
  }

  const { data: bookings, loading, refetch } = useApiData<Booking[]>(
    (token) => api.bookings.list(token, statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  )

  const { data: tenant } = useApiData<Tenant>((token) => api.tenants.me(token))

  const durationMinutes = slotDurationMinutesFromBuffers(tenant?.booking_buffers)
  const calendarTz = (tenant?.timezone || tenantTz || 'UTC').trim() || 'UTC'

  // Deep link: /bookings?booking=<id> (bell) or /bookings?b=<token> (email).
  useEffect(() => {
    const encoded = (searchParams.get('b') || '').trim()
    const id =
      (searchParams.get('booking') || '').trim() ||
      (encoded ? decodeBookingId(encoded) || '' : '')
    if (!id || deepLinkedRef.current === id) return

    let cancelled = false
    const resolveAndOpen = async () => {
      const found = (bookings ?? []).find((b) => b.id === id)
      if (found) {
        if (!cancelled) {
          deepLinkedRef.current = id
          setSelectedBooking(found)
        }
        return
      }
      try {
        const token = await getToken()
        const b = await api.bookings.get(token, id)
        if (!cancelled) {
          deepLinkedRef.current = id
          setSelectedBooking(b)
        }
      } catch {
        // Booking may be gone or cross-tenant; leave the page as-is.
      }
    }

    void resolveAndOpen()
    return () => {
      cancelled = true
    }
  }, [searchParams, bookings, getToken])

  const closeDetails = () => {
    setSelectedBooking(null)
    if (searchParams.get('booking') || searchParams.get('b')) {
      deepLinkedRef.current = null
      const params = new URLSearchParams(searchParams.toString())
      params.delete('booking')
      params.delete('b')
      const q = params.toString()
      router.replace(q ? `/bookings?${q}` : '/bookings', { scroll: false })
    }
  }

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
  const filteredBookings = displayBookings.filter((booking) => {
    if (!matchesSearch(booking)) return false
    if (pageTab === 'list' && !matchesScheduleRange(booking)) return false
    return true
  })
  const hasActiveFilters = Boolean(
    phoneSearch ||
      statusFilter ||
      (pageTab === 'list' && (scheduleDateFrom || scheduleDateTo)),
  )

  let overdueCount = 0
  let todayCount = 0
  for (const b of displayBookings) {
    const s = getSchedulingMeta(b, tenantTz).state
    if (s === 'overdue') overdueCount++
    else if (s === 'today') todayCount++
  }

  const prettyStatus = (s: string) => s.replace('_', ' ')

  const stopBubble = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
  }
  const openDetails = (booking: Booking) => setSelectedBooking(booking)
  const openAction = (booking: Booking, action: BookingAction) =>
    setActiveAction({ booking, action })
  const openCreate = (initialSlot?: string | null) =>
    setFormState({ mode: 'create', initialSlot: initialSlot ?? null })
  const openEdit = (booking: Booking) => {
    setSelectedBooking(null)
    setFormState({ mode: 'edit', booking })
  }

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
    <PageShell>
      <PageHeader
        title="Bookings"
        description="View your schedule on the calendar or browse the list. Create, edit, and update booking status from either view."
      >
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
            <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
            {overdueCount} overdue
          </span>
        )}
        {todayCount > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
            {todayCount} today
          </span>
        )}
        <Button outline onClick={() => refetch()} disabled={loading}>
          <ArrowPathIcon
            data-slot="icon"
            className={loading ? 'animate-spin' : undefined}
          />
          Refresh
        </Button>
        <Button color="brand" onClick={() => openCreate()}>
          <PlusIcon data-slot="icon" />
          New booking
        </Button>
      </PageHeader>

      <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
        <SegmentButton active={pageTab === 'calendar'} onClick={() => setPageTab('calendar')}>
          Calendar
        </SegmentButton>
        <SegmentButton active={pageTab === 'list'} onClick={() => setPageTab('list')}>
          List
        </SegmentButton>
      </div>

      <FilterPanel>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            placeholder="Search by phone or name..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
          />
        </div>
        {pageTab === 'list' && (
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
        )}
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
        {pageTab === 'list' && (
          <div className="ml-auto inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <SegmentButton active={layoutMode === 'box'} onClick={() => setLayoutMode('box')}>
              Box view
            </SegmentButton>
            <SegmentButton active={layoutMode === 'list'} onClick={() => setLayoutMode('list')}>
              List view
            </SegmentButton>
          </div>
        )}
      </FilterPanel>

      {pageTab === 'calendar' ? (
        loading ? (
          <div className="h-128 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
        ) : (
          <BookingsCalendar
            bookings={filteredBookings}
            timeZone={calendarTz}
            workingHours={tenant?.working_hours}
            durationMinutes={durationMinutes}
            onEventClick={openDetails}
            onEventEdit={openEdit}
            onSlotSelect={(slot) => openCreate(slot)}
          />
        )
      ) : (
        <div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-2xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : filteredBookings.length > 0 ? (
            <div key={layoutMode} className="bookings-layout-animate">
              {layoutMode === 'box' ? (
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
                        className={`group relative cursor-pointer border shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:border-zinc-600 ${cardTone}`}
                      >
                        <HoverIconActions onEdit={() => openEdit(booking)} />
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

                          <div className="space-y-2.5 rounded-xl bg-zinc-50 px-3 py-3 dark:bg-zinc-800/70">
                            <FieldRow label="Service">{booking.service_type}</FieldRow>
                            <FieldRow label="Scheduled">
                              <ScheduledLine booking={booking} meta={meta} timeZone={tenantTz} />
                            </FieldRow>
                            <FieldRow label="Source">
                              <span className="inline-flex justify-end">
                                <SourceBadge channel={booking.source_channel} />
                              </span>
                            </FieldRow>
                            {(booking.source_channel.toLowerCase() === 'call' ||
                              booking.source_channel.toLowerCase() === 'api') && (
                              <FieldRow
                                label={
                                  booking.source_channel.toLowerCase() === 'call'
                                    ? 'Vapi number'
                                    : 'Created from'
                                }
                              >
                                <span className="font-mono text-xs">
                                  {booking.source_contact || booking.customer_phone || '—'}
                                </span>
                              </FieldRow>
                            )}
                          </div>

                          {ACTIVE_STATUSES.has(booking.status) && (
                            <div className="flex flex-wrap justify-end gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                              {renderActionButtons(booking)}
                            </div>
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
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/80">
                  <table className="w-full min-w-[920px] table-fixed text-left text-sm">
                    <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
                      <tr>
                        <th className="w-[18%] px-4 py-3 font-semibold">Customer</th>
                        <th className="w-[20%] px-3 py-3 font-semibold">Scheduled</th>
                        <th className="w-[22%] px-3 py-3 font-semibold">Service</th>
                        <th className="w-[14%] px-3 py-3 font-semibold">Source</th>
                        <th className="w-[10%] px-3 py-3 font-semibold">Status</th>
                        <th className="w-[16%] px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((booking) => {
                        const meta = getSchedulingMeta(booking, tenantTz)
                        const rowTone =
                          meta.state === 'overdue'
                            ? 'bg-red-50/50 dark:bg-red-500/5'
                            : meta.state === 'today'
                              ? 'bg-amber-50/40 dark:bg-amber-500/5'
                              : ''
                        return (
                          <tr
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
                            className={`cursor-pointer border-t border-zinc-100 align-top hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:hover:bg-white/5 ${rowTone}`}
                          >
                            <td className="px-4 py-3">
                              <p className="truncate font-semibold text-zinc-950 dark:text-white">
                                {booking.customer_name}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {booking.customer_phone}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-sm leading-5">
                                <ScheduledLine booking={booking} meta={meta} timeZone={tenantTz} />
                              </p>
                              {(meta.state === 'overdue' || meta.state === 'today') && (
                                <div className="mt-1.5">
                                  <ScheduleBadge meta={meta} />
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <p className="line-clamp-2 text-sm leading-5 text-zinc-800 dark:text-zinc-200">
                                {booking.service_type}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <SourceBadge channel={booking.source_channel} />
                              {booking.source_contact ? (
                                <p className="mt-1 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {booking.source_contact}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              <Badge color={statusColor(booking.status)}>
                                {prettyStatus(booking.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <Button
                                  plain
                                  className="text-xs"
                                  onClick={(e) => {
                                    stopBubble(e)
                                    openEdit(booking)
                                  }}
                                >
                                  Edit
                                </Button>
                                {ACTIVE_STATUSES.has(booking.status) && renderActionButtons(booking)}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {hasActiveFilters ? 'No bookings found for selected filters' : 'No bookings yet'}
            </p>
          )}
        </div>
      )}

      <BookingDetailsDialog
        open={selectedBooking !== null}
        booking={selectedBooking}
        onClose={closeDetails}
        onEdit={openEdit}
        onComplete={(b) => openAction(b, 'complete')}
        onNoShow={(b) => openAction(b, 'no-show')}
        onCancel={(b) => openAction(b, 'cancel')}
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

      <BookingFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        booking={formState?.booking}
        initialSlot={formState?.initialSlot}
        onClose={() => setFormState(null)}
        onSaved={() => {
          refetch()
        }}
      />
    </PageShell>
  )
}

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsPageInner />
    </Suspense>
  )
}

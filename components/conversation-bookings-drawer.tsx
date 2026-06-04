'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { ChannelIcon, channelLabel } from '@/components/channel-icon'
import { BookingDetailsDialog } from '@/components/booking-details-dialog'
import { useApiToken, useTenantTimezone } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDateTime, formatRelativeTime, statusColor } from '@/lib/utils'
import type { Booking } from '@/lib/types'

const ACTIVE_STATUSES = new Set(['confirmed', 'rescheduled'])

const prettyStatus = (s: string) => s.replace('_', ' ')

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

type SchedulingState = 'overdue' | 'today' | 'upcoming' | 'past' | 'unknown'

function schedulingState(
  booking: Booking,
  timeZone: string,
  now = new Date(),
): SchedulingState {
  if (!booking.selected_slot) return 'unknown'
  const slot = new Date(booking.selected_slot)
  if (Number.isNaN(slot.getTime())) return 'unknown'
  const dayKey = dayKeyInTz(slot, timeZone)
  const todayKey = dayKeyInTz(now, timeZone)
  const stillActive = ACTIVE_STATUSES.has(booking.status)
  if (dayKey < todayKey) return stillActive ? 'overdue' : 'past'
  if (dayKey === todayKey) return 'today'
  return 'upcoming'
}

function ScheduleBadge({ state }: { state: SchedulingState }) {
  if (state === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
        Overdue
      </span>
    )
  }
  if (state === 'today') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        Today
      </span>
    )
  }
  if (state === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/30">
        Upcoming
      </span>
    )
  }
  return null
}

function EmptyState({
  customerName,
  channel,
}: {
  customerName: string
  channel?: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-linear-to-br from-sky-100 to-blue-100 ring-1 ring-sky-200 dark:from-sky-500/15 dark:to-blue-500/10 dark:ring-sky-500/20">
        <CalendarIcon
          className="size-10 text-sky-500 dark:text-sky-400"
          aria-hidden="true"
        />
      </div>
      <div className="max-w-xs">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-white">
          No bookings yet
        </h4>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {customerName
            ? `${customerName} hasn’t scheduled an appointment from this conversation.`
            : 'This contact hasn’t scheduled an appointment yet.'}
          {channel && (
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <ChannelIcon channel={channel} className="size-3" />
              {channelLabel(channel)} thread
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

function BookingRow({
  booking,
  timeZone,
  onOpen,
}: {
  booking: Booking
  timeZone: string
  onOpen: (b: Booking) => void
}) {
  const state = schedulingState(booking, timeZone)
  const tone =
    state === 'overdue'
      ? 'border-red-200 bg-red-50/40 dark:border-red-500/30 dark:bg-red-500/5'
      : state === 'today'
        ? 'border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5'
        : 'border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800/40'
  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      className={`group flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${tone}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {booking.service_type || 'Appointment'}
            </p>
            <ScheduleBadge state={state} />
          </div>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
            {booking.selected_slot ? formatDateTime(booking.selected_slot, timeZone) : '—'}
          </p>
        </div>
        <Badge color={statusColor(booking.status)}>{prettyStatus(booking.status)}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {booking.customer_phone && (
          <span className="inline-flex items-center gap-1">
            <PhoneIcon className="size-3.5" aria-hidden="true" />
            <span className="font-mono text-[11px]">{booking.customer_phone}</span>
          </span>
        )}
        {booking.customer_address && (
          <span className="inline-flex max-w-45 items-center gap-1 truncate">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{booking.customer_address}</span>
          </span>
        )}
      </div>

      {booking.status_note && (
        <p className="rounded-md bg-zinc-50 px-2 py-1 text-xs italic text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          “{booking.status_note}”
        </p>
      )}

      {booking.status_changed_at && booking.status !== 'confirmed' && (
        <p className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
          <ClockIcon className="size-3" aria-hidden="true" />
          {prettyStatus(booking.status)} {formatRelativeTime(booking.status_changed_at)}
        </p>
      )}
    </button>
  )
}

export function ConversationBookingsDrawer({
  open,
  onClose,
  conversationId,
  customerName,
  channel,
}: {
  open: boolean
  onClose: () => void
  conversationId: string | null
  customerName: string
  channel?: string
}) {
  const getToken = useApiToken()
  const tenantTz = useTenantTimezone()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openBooking, setOpenBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (!open || !conversationId) {
      setBookings([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const token = await getToken()
        const data = await api.bookings.searchByConversation(token, conversationId)
        if (!cancelled) setBookings(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load bookings')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, conversationId, getToken])

  // Close on Escape — feels like a real drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Bucket the list so the drawer leads with what an operator usually cares
  // about: things that need attention right now.
  const overdue: Booking[] = []
  const today: Booking[] = []
  const upcoming: Booking[] = []
  const past: Booking[] = []
  for (const b of bookings) {
    const s = schedulingState(b, tenantTz)
    if (s === 'overdue') overdue.push(b)
    else if (s === 'today') today.push(b)
    else if (s === 'upcoming') upcoming.push(b)
    else past.push(b)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* Panel */}
      <aside
        aria-hidden={!open}
        aria-label="Bookings for this conversation"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-white/10 dark:bg-zinc-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Bookings
            </p>
            <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">
              {customerName || 'Contact'}
            </h3>
            {channel && (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <ChannelIcon channel={channel} className="size-3.5" />
                {channelLabel(channel)} conversation
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bookings"
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <XMarkIcon className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState customerName={customerName} channel={channel} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2 text-center">
                <SummaryTile label="Overdue" value={overdue.length} tone="red" />
                <SummaryTile label="Today" value={today.length} tone="amber" />
                <SummaryTile
                  label="Upcoming"
                  value={upcoming.length}
                  tone="brand"
                />
              </div>
              <BookingsGroup
                title="Overdue"
                items={overdue}
                timeZone={tenantTz}
                onOpen={setOpenBooking}
              />
              <BookingsGroup
                title="Today"
                items={today}
                timeZone={tenantTz}
                onOpen={setOpenBooking}
              />
              <BookingsGroup
                title="Upcoming"
                items={upcoming}
                timeZone={tenantTz}
                onOpen={setOpenBooking}
              />
              <BookingsGroup
                title="Past"
                items={past}
                timeZone={tenantTz}
                onOpen={setOpenBooking}
                muted
              />
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <span>
            {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} for this contact
          </span>
          <Button plain onClick={onClose} className="text-xs">
            Close
          </Button>
        </footer>
      </aside>

      <BookingDetailsDialog
        open={openBooking !== null}
        booking={openBooking}
        onClose={() => setOpenBooking(null)}
      />
    </>
  )
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'red' | 'amber' | 'brand'
}) {
  const tones: Record<typeof tone, string> = {
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    brand:
      'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  }
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
    </div>
  )
}

function BookingsGroup({
  title,
  items,
  timeZone,
  onOpen,
  muted,
}: {
  title: string
  items: Booking[]
  timeZone: string
  onOpen: (b: Booking) => void
  muted?: boolean
}) {
  if (items.length === 0) return null
  return (
    <section>
      <h4
        className={`mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide ${
          muted
            ? 'text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-500 dark:text-zinc-400'
        }`}
      >
        {title}
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {items.length}
        </span>
      </h4>
      <div className="space-y-2">
        {items.map((b) => (
          <BookingRow key={b.id} booking={b} timeZone={timeZone} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

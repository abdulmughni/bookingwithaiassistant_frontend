import type { EventInput } from '@fullcalendar/core'
import { parseWorkingHours, type DayKey } from '@/components/working-hours-editor'
import type { Booking } from '@/lib/types'

const DAY_TO_FC: Record<DayKey, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

export type FcBusinessHours = {
  daysOfWeek: number[]
  startTime: string
  endTime: string
}

export const DEFAULT_SLOT_DURATION_MINUTES = 90

/** Read slot length from tenant booking_buffers (Settings). */
export function slotDurationMinutesFromBuffers(
  buffers: Record<string, unknown> | null | undefined,
): number {
  const raw = buffers?.slot_duration_minutes
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SLOT_DURATION_MINUTES
  return Math.max(15, Math.round(n))
}

/** Map Settings working_hours → FullCalendar businessHours. */
export function toBusinessHours(
  workingHours: Record<string, unknown> | null | undefined,
): FcBusinessHours[] {
  const state = parseWorkingHours(workingHours)
  const out: FcBusinessHours[] = []
  for (const key of Object.keys(DAY_TO_FC) as DayKey[]) {
    const day = state[key]
    if (!day.open) continue
    out.push({
      daysOfWeek: [DAY_TO_FC[key]],
      startTime: day.start.length === 5 ? day.start : day.start.slice(0, 5),
      endTime: day.end.length === 5 ? day.end : day.end.slice(0, 5),
    })
  }
  return out
}

/** Earliest open / latest close across open days for slotMinTime / slotMaxTime. */
export function slotWindowFromWorkingHours(
  workingHours: Record<string, unknown> | null | undefined,
): { slotMinTime: string; slotMaxTime: string } {
  const hours = toBusinessHours(workingHours)
  if (hours.length === 0) {
    return { slotMinTime: '06:00:00', slotMaxTime: '22:00:00' }
  }
  let min = '23:59'
  let max = '00:00'
  for (const h of hours) {
    if (h.startTime < min) min = h.startTime
    if (h.endTime > max) max = h.endTime
  }
  // Pad slightly so edges aren't clipped.
  const padStart = addMinutesToHhMm(min, -30)
  const padEnd = addMinutesToHhMm(max, 30)
  return {
    slotMinTime: `${padStart}:00`,
    slotMaxTime: `${padEnd}:00`,
  }
}

function addMinutesToHhMm(hhmm: string, delta: number): string {
  const [hStr, mStr] = hhmm.split(':')
  let total = Number(hStr) * 60 + Number(mStr) + delta
  total = Math.max(0, Math.min(24 * 60 - 1, total))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function statusClassName(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'fc-booking-confirmed'
    case 'rescheduled':
      return 'fc-booking-rescheduled'
    case 'completed':
      return 'fc-booking-completed'
    case 'cancelled':
      return 'fc-booking-cancelled'
    case 'no_show':
      return 'fc-booking-no-show'
    default:
      return 'fc-booking-default'
  }
}

/** Convert a booking into a FullCalendar event (null if no scheduled slot). */
export function bookingToEvent(
  booking: Booking,
  durationMinutes: number,
): EventInput | null {
  if (!booking.selected_slot) return null
  const start = new Date(booking.selected_slot)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60_000)
  const service = (booking.service_type || '').trim()
  const title = service
    ? `${booking.customer_name} · ${service}`
    : booking.customer_name || 'Booking'
  return {
    id: booking.id,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    classNames: [statusClassName(booking.status)],
    extendedProps: { booking },
  }
}

export function bookingsToEvents(
  bookings: Booking[],
  durationMinutes: number,
): EventInput[] {
  const events: EventInput[] = []
  for (const b of bookings) {
    const ev = bookingToEvent(b, durationMinutes)
    if (ev) events.push(ev)
  }
  return events
}

/**
 * Format a Date as `YYYY-MM-DDTHH:mm` wall-clock in an IANA timezone
 * (for datetime-local inputs / naive ISO the API accepts as tenant-local).
 */
export function formatInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/** Parse datetime-local value as naive ISO string for the bookings API. */
export function datetimeLocalToApiSlot(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  // Ensure seconds so backend parsers are happy.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  return trimmed
}

/** Convert API ISO instant → datetime-local string in tenant TZ. */
export function apiSlotToDatetimeLocal(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatInTimeZone(d, timeZone)
}

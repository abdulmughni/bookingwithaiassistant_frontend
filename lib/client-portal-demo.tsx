'use client'

import { useSyncExternalStore } from 'react'

import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import { dashCardClass } from '@/components/dashboard-ui'
import { shiftDateKey } from '@/lib/report-range'
import type {
  Booking,
  CallLogDetail,
  CallLogSummary,
  CallStats,
  ChannelAccount,
  Conversation,
  Customer,
  CustomerDetail,
  Message,
  TenantStats,
} from '@/lib/types'

const STORAGE_KEY = 'client-portal-demo'
const CHANGE_EVENT = 'client-portal-demo-changed'

/**
 * Sample client-dashboard data for screenshots.
 * On by default. Turn it off from the bottom of Settings to see live numbers.
 * Delete this file when the screenshots are done.
 */

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

function readEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function useClientPortalDemo() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true)

  function setDemo(next: boolean) {
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  return { enabled, setDemo }
}

export function ClientDemoDataSwitch() {
  const { enabled, setDemo } = useClientPortalDemo()
  return (
    <section className={`${dashCardClass} p-5`}>
      <Subheading>Sample dashboard data</Subheading>
      <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Fills the client portal with realistic bookings, clients, messages, and calls for a presentation.
        Turn this off to see this account&apos;s live numbers.
      </Text>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setDemo(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-[#fff] shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
        <Text className="text-sm text-zinc-700 dark:text-zinc-300">
          {enabled ? 'Sample data is on' : 'Sample data is off'}
        </Text>
      </div>
    </section>
  )
}

const MONTH_WEIGHT: Record<number, number> = {
  1: 1.35,
  2: 1.2,
  3: 0.85,
  4: 0.7,
  5: 0.78,
  6: 1.15,
  7: 1.45,
  8: 1.32,
  9: 0.82,
  10: 0.98,
  11: 1.22,
  12: 1.4,
}

function hash(value: string) {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function roll(date: string, salt: string) {
  return (hash(`${date}:${salt}`) % 10000) / 10000
}

function eachDay(start: string, end: string) {
  const days: string[] = []
  let cursor = start
  while (cursor <= end && days.length < 400) {
    days.push(cursor)
    cursor = shiftDateKey(cursor, 1)
  }
  return days
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function daysBefore(date: string, today: string) {
  const start = Date.parse(`${date}T12:00:00Z`)
  const end = Date.parse(`${today}T12:00:00Z`)
  return Math.max(0, Math.round((end - start) / 86400000))
}

type DayCounts = {
  date: string
  bookings: number
  completed: number
  confirmed: number
  cancelled: number
  calls: number
  messages: number
  conversations: number
}

function allocate(total: number, weights: number[], salt: string) {
  const raw = weights.map((weight) => weight * total)
  const counts = raw.map((value) => Math.floor(value))
  let left = total - counts.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value), tie: hash(`${salt}:${index}`) }))
    .sort((a, b) => b.frac - a.frac || a.tie - b.tie)
  for (const item of order) {
    if (left <= 0) break
    counts[item.index] += 1
    left -= 1
  }
  return counts
}

function statusWeights(age: number) {
  if (age <= 14) return [0.22, 0.6, 0.06, 0.12]
  if (age <= 45) return [0.4, 0.4, 0.1, 0.1]
  return [0.84, 0, 0.1, 0.06]
}

function tallyStatus(date: string, bookings: number, age: number) {
  const weights = statusWeights(age)
  const counts = [0, 0, 0, 0]
  for (let index = 0; index < bookings; index += 1) {
    const chance = roll(date, `status${index}`)
    let cursor = 0
    let placed = false
    for (let status = 0; status < weights.length; status += 1) {
      cursor += weights[status]
      if (chance < cursor) {
        counts[status] += 1
        placed = true
        break
      }
    }
    if (!placed) counts[0] += 1
  }
  return counts
}

function dayCounts(date: string, today: string): DayCounts {
  const month = Number(date.slice(5, 7))
  const weight = MONTH_WEIGHT[month] ?? 1
  const weekend = weekday(date) === 0 || weekday(date) === 6
  const chance = roll(date, 'book') * weight
  let bookings = 0
  if (weekend) bookings = roll(date, 'weekend') < 0.16 * Math.min(weight, 1.35) ? 1 : 0
  else if (chance > 1.25) bookings = 2
  else if (chance > 0.36) bookings = 1

  const [completed, confirmed, cancelled] = tallyStatus(date, bookings, daysBefore(date, today))
  const callExtra = weekend
    ? roll(date, 'call') < 0.28 ? 1 : 0
    : (roll(date, 'call') < 0.74 ? 1 : 0) + (roll(date, 'call2') < 0.22 ? 1 : 0)
  const calls = bookings + callExtra
  const messages = calls + (roll(date, 'msg') < 0.4 ? 1 : 0) + (weekend ? 0 : roll(date, 'msg2') < 0.3 ? 1 : 0)
  const conversations = bookings + (!weekend && roll(date, 'chat') < 0.38 ? 1 : 0)
  return { date, bookings, completed, confirmed, cancelled, calls, messages, conversations }
}

function sumDays(days: DayCounts[]) {
  return days.reduce(
    (sum, day) => ({
      bookings: sum.bookings + day.bookings,
      completed: sum.completed + day.completed,
      confirmed: sum.confirmed + day.confirmed,
      cancelled: sum.cancelled + day.cancelled,
      calls: sum.calls + day.calls,
      messages: sum.messages + day.messages,
      conversations: sum.conversations + day.conversations,
    }),
    { bookings: 0, completed: 0, confirmed: 0, cancelled: 0, calls: 0, messages: 0, conversations: 0 },
  )
}

function toStats(days: DayCounts[], today: string, withPrevious: boolean): TenantStats {
  const totals = sumDays(days)
  const recent = days.filter((day) => day.date >= shiftDateKey(today, -9))
  const active = recent.reduce((sum, day) => sum + (day.conversations > 0 ? 1 : 0), 0)
  let previous: ReturnType<typeof sumDays> | null = null
  if (withPrevious && days.length > 0) {
    const start = shiftDateKey(days[0].date, -days.length)
    const end = shiftDateKey(days[0].date, -1)
    previous = sumDays(eachDay(start, end).map((date) => dayCounts(date, today)))
  }
  return {
    total_bookings: totals.bookings,
    confirmed_bookings: totals.confirmed,
    completed_bookings: totals.completed,
    cancelled_bookings: totals.cancelled,
    upcoming_bookings: totals.confirmed,
    active_conversations: withPrevious ? totals.conversations : Math.max(6, Math.min(12, active)),
    total_channel_accounts: 2,
    total_calls: totals.calls,
    daily: days.map((day) => ({ date: day.date, count: day.bookings })),
    completed_daily: days.map((day) => ({ date: day.date, count: day.completed })),
    conversation_daily: days.map((day) => ({ date: day.date, count: day.conversations })),
    upcoming_daily: days.map((day) => ({ date: day.date, count: day.confirmed })),
    call_daily: days.map((day) => ({ date: day.date, count: day.calls })),
    message_daily: days.map((day) => ({ date: day.date, count: day.messages })),
    previous_total_bookings: previous?.bookings ?? null,
    previous_completed_bookings: previous?.completed ?? null,
    previous_upcoming_bookings: previous?.confirmed ?? null,
    previous_active_conversations: previous?.conversations ?? null,
    range_start: days[0]?.date ?? null,
    range_end: days[days.length - 1]?.date ?? null,
  }
}

type SampleJob = {
  daysFromToday: number
  hour: number
  minute: number
  name: string
  service: string
  status: Booking['status']
  channel: Booking['source_channel']
  phone: string
  address: string
}

const SAMPLE_JOBS: SampleJob[] = [
  { daysFromToday: 8, hour: 9, minute: 0, name: 'Maria Alvarez', service: 'Furnace tune-up', status: 'confirmed', channel: 'call', phone: '(415) 555-0148', address: '1842 Chestnut St, San Francisco, CA' },
  { daysFromToday: 6, hour: 13, minute: 30, name: 'James Whitfield', service: 'Heat pump maintenance', status: 'confirmed', channel: 'call', phone: '(628) 555-0172', address: '90 Clayton St, San Francisco, CA' },
  { daysFromToday: 5, hour: 10, minute: 0, name: 'Priya Shah', service: 'Thermostat replacement', status: 'confirmed', channel: 'instagram', phone: '(415) 555-0194', address: '55 Dolores St, San Francisco, CA' },
  { daysFromToday: 4, hour: 15, minute: 0, name: 'Daniel Okonkwo', service: 'Duct cleaning', status: 'confirmed', channel: 'facebook', phone: '(510) 555-0133', address: '2210 Russell St, Berkeley, CA' },
  { daysFromToday: 3, hour: 8, minute: 30, name: 'Helen Brooks', service: 'Annual heating inspection', status: 'confirmed', channel: 'call', phone: '(415) 555-0160', address: '740 18th Ave, San Francisco, CA' },
  { daysFromToday: 2, hour: 11, minute: 0, name: 'Chris Nguyen', service: 'No-heat emergency', status: 'confirmed', channel: 'call', phone: '(650) 555-0188', address: '418 Elm St, San Mateo, CA' },
  { daysFromToday: 1, hour: 16, minute: 0, name: 'Sofia Reyes', service: 'Mini-split installation', status: 'rescheduled', channel: 'whatsapp', phone: '(415) 555-0117', address: '12 Precita Ave, San Francisco, CA' },
  { daysFromToday: 0, hour: 9, minute: 30, name: 'Robert Hale', service: 'Filter and coil cleaning', status: 'confirmed', channel: 'call', phone: '(415) 555-0104', address: '3301 Mission St, San Francisco, CA' },
  { daysFromToday: 0, hour: 11, minute: 30, name: 'Olivia Grant', service: 'Thermostat replacement', status: 'confirmed', channel: 'call', phone: '(650) 555-0136', address: '155 Bovet Rd, San Mateo, CA' },
  { daysFromToday: 0, hour: 15, minute: 0, name: 'Ian Foster', service: 'Furnace tune-up', status: 'confirmed', channel: 'facebook', phone: '(415) 555-0144', address: '2701 Bryant St, San Francisco, CA' },
  { daysFromToday: 1, hour: 9, minute: 0, name: 'Grace Kim', service: 'Duct cleaning', status: 'confirmed', channel: 'instagram', phone: '(415) 555-0169', address: '1450 Greenwich St, San Francisco, CA' },
  { daysFromToday: -1, hour: 14, minute: 0, name: 'Amina Farouk', service: 'AC not cooling', status: 'completed', channel: 'instagram', phone: '(510) 555-0166', address: '88 Linda Ave, Oakland, CA' },
  { daysFromToday: -1, hour: 10, minute: 0, name: 'Kevin Marsh', service: 'Gas furnace repair', status: 'completed', channel: 'call', phone: '(415) 555-0190', address: '1560 Grove St, San Francisco, CA' },
  { daysFromToday: -2, hour: 13, minute: 0, name: 'Lauren Peck', service: 'Condensate drain leak', status: 'completed', channel: 'facebook', phone: '(628) 555-0125', address: '44 Cole St, San Francisco, CA' },
  { daysFromToday: -3, hour: 9, minute: 0, name: 'Omar Haddad', service: 'Blower motor replacement', status: 'completed', channel: 'call', phone: '(650) 555-0142', address: '910 Laurel St, San Carlos, CA' },
  { daysFromToday: -3, hour: 15, minute: 30, name: 'Nina Patel', service: 'Thermostat not responding', status: 'cancelled', channel: 'call', phone: '(415) 555-0177', address: '2001 California St, San Francisco, CA' },
  { daysFromToday: -4, hour: 11, minute: 30, name: 'George Bennett', service: 'Furnace tune-up', status: 'completed', channel: 'call', phone: '(415) 555-0138', address: '67 Anderson St, San Francisco, CA' },
  { daysFromToday: -5, hour: 8, minute: 0, name: 'Emily Cho', service: 'Water heater flush', status: 'completed', channel: 'whatsapp', phone: '(510) 555-0198', address: '1401 Alice St, Oakland, CA' },
  { daysFromToday: -6, hour: 13, minute: 0, name: 'Andre Williams', service: 'Heat pump maintenance', status: 'rescheduled', channel: 'facebook', phone: '(415) 555-0121', address: '505 Cortland Ave, San Francisco, CA' },
  { daysFromToday: -8, hour: 10, minute: 30, name: 'Rachel Stein', service: 'Annual heating inspection', status: 'completed', channel: 'call', phone: '(650) 555-0114', address: '22 Hillcrest Dr, Millbrae, CA' },
  { daysFromToday: -9, hour: 14, minute: 30, name: 'Luis Romero', service: 'Duct cleaning', status: 'completed', channel: 'instagram', phone: '(415) 555-0183', address: '318 Jersey St, San Francisco, CA' },
  { daysFromToday: -11, hour: 9, minute: 0, name: 'Hannah Cole', service: 'No-heat emergency', status: 'completed', channel: 'call', phone: '(628) 555-0155', address: '880 Bush St, San Francisco, CA' },
  { daysFromToday: -12, hour: 16, minute: 0, name: 'Malik Johnson', service: 'Filter and coil cleaning', status: 'cancelled', channel: 'facebook', phone: '(510) 555-0109', address: '5735 Telegraph Ave, Oakland, CA' },
  { daysFromToday: -14, hour: 11, minute: 0, name: 'Grace Kim', service: 'Thermostat replacement', status: 'completed', channel: 'call', phone: '(415) 555-0169', address: '1450 Greenwich St, San Francisco, CA' },
  { daysFromToday: -16, hour: 8, minute: 30, name: 'Victor Alvarez', service: 'Gas furnace repair', status: 'completed', channel: 'call', phone: '(650) 555-0170', address: '640 Woodside Rd, Redwood City, CA' },
  { daysFromToday: -18, hour: 13, minute: 30, name: 'Natalie Brooks', service: 'Mini-split installation', status: 'completed', channel: 'instagram', phone: '(415) 555-0128', address: '99 Sanchez St, San Francisco, CA' },
  { daysFromToday: -21, hour: 10, minute: 0, name: 'Ian Foster', service: 'Furnace tune-up', status: 'completed', channel: 'call', phone: '(415) 555-0144', address: '2701 Bryant St, San Francisco, CA' },
  { daysFromToday: -24, hour: 15, minute: 0, name: 'Diane Walsh', service: 'AC not cooling', status: 'completed', channel: 'facebook', phone: '(510) 555-0181', address: '412 40th St, Oakland, CA' },
  { daysFromToday: -27, hour: 9, minute: 30, name: 'Samir Rahman', service: 'Heat pump maintenance', status: 'completed', channel: 'call', phone: '(415) 555-0196', address: '18 Norfolk St, San Francisco, CA' },
  { daysFromToday: -30, hour: 12, minute: 0, name: 'Olivia Grant', service: 'Duct cleaning', status: 'completed', channel: 'call', phone: '(650) 555-0136', address: '155 Bovet Rd, San Mateo, CA' },
  { daysFromToday: -33, hour: 14, minute: 0, name: 'Ben Carter', service: 'Condensate drain leak', status: 'cancelled', channel: 'instagram', phone: '(415) 555-0112', address: '760 Valencia St, San Francisco, CA' },
  { daysFromToday: -36, hour: 9, minute: 0, name: 'Jason Hale', service: 'Annual heating inspection', status: 'completed', channel: 'facebook', phone: '(628) 555-0147', address: '1201 Funston Ave, San Francisco, CA' },
  { daysFromToday: -39, hour: 11, minute: 30, name: 'Megan Ortiz', service: 'Thermostat replacement', status: 'completed', channel: 'instagram', phone: '(415) 555-0152', address: '340 Dolores St, San Francisco, CA' },
  { daysFromToday: -42, hour: 8, minute: 0, name: 'Paul Ricci', service: 'Furnace tune-up', status: 'completed', channel: 'facebook', phone: '(510) 555-0174', address: '901 Mandana Blvd, Oakland, CA' },
  { daysFromToday: -45, hour: 15, minute: 0, name: 'Keisha Brown', service: 'No-heat emergency', status: 'rescheduled', channel: 'facebook', phone: '(415) 555-0186', address: '44 South Park St, San Francisco, CA' },
]

function wallTimeToIso(day: string, hour: number, minute: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    hour,
    minute,
    0,
  ))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcGuess)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'))
  return new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime())).toISOString()
}

export function sampleBookings(today: string, timeZone: string): Booking[] {
  const now = new Date().toISOString()
  return SAMPLE_JOBS.map((job, index) => {
    const day = shiftDateKey(today, job.daysFromToday)
    const slot = wallTimeToIso(day, job.hour, job.minute, timeZone)
    return {
      id: `sample-booking-${index + 1}`,
      tenant_id: 'sample',
      conversation_id: null,
      source_channel: job.channel,
      source_contact: job.phone,
      customer_id: `sample-customer-${index + 1}`,
      customer_name: job.name,
      customer_phone: job.phone,
      customer_address: job.address,
      service_type: job.service,
      selected_slot: slot,
      notes: null,
      crm_job_id: null,
      crm_contact_id: null,
      status: job.status,
      status_note: null,
      status_changed_at: slot,
      chat_summary: null,
      created_at: slot,
      updated_at: now,
    }
  }).sort((a, b) => (b.selected_slot ?? '').localeCompare(a.selected_slot ?? ''))
}

function pagePhoto(seed: string, background: string) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${background}&textColor=ffffff&fontWeight=600`
}

export function sampleChannels(today: string): ChannelAccount[] {
  const connectedAt = `${shiftDateKey(today, -120)}T16:00:00.000Z`
  const checkedAt = `${today}T15:10:00.000Z`
  return [
    {
      tenant_id: 'sample',
      channel: 'facebook',
      account_id: 'skyline-hvac',
      label: 'Skyline HVAC',
      picture_url: pagePhoto('Skyline HVAC', '1d4ed8'),
      is_active: true,
      verify_token: '',
      has_access_token: true,
      ai_enabled: true,
      connection_status: 'verified',
      connection_message: 'Connected with Facebook Login.',
      last_verified_at: checkedAt,
      created_at: connectedAt,
      updated_at: checkedAt,
    },
    {
      tenant_id: 'sample',
      channel: 'instagram',
      account_id: 'skyline.hvac',
      label: 'skyline.hvac',
      picture_url: pagePhoto('SH', '9d174d'),
      is_active: true,
      verify_token: '',
      has_access_token: true,
      ai_enabled: true,
      connection_status: 'verified',
      connection_message: 'Connected via linked Facebook Page.',
      last_verified_at: checkedAt,
      created_at: connectedAt,
      updated_at: checkedAt,
    },
  ]
}

export function clientDashboardDemo(input: {
  today: string
  timeZone: string
  start?: string
  end?: string
}) {
  const { today, timeZone } = input
  const yearStart = shiftDateKey(today, -364)
  const yearDays = eachDay(yearStart, today).map((date) => dayCounts(date, today))
  const yearTotals = sumDays(yearDays)
  const [facebookBookings, instagramBookings] = allocate(
    yearTotals.bookings,
    [0.17, 0.12, 0.71],
    'channels',
  )
  const ranged = Boolean(input.start && input.end)
  const windowDays = ranged
    ? eachDay(input.start! <= input.end! ? input.start! : input.end!, input.start! <= input.end! ? input.end! : input.start!).map((date) => dayCounts(date, today))
    : yearDays

  return {
    stats: toStats(windowDays, today, ranged),
    bookings: sampleBookings(today, timeZone),
    channels: sampleChannels(today),
    facebookBookings,
    instagramBookings,
  }
}

function emailFor(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')
  const host = hash(name) % 5 === 0 ? 'icloud.com' : hash(name) % 2 === 0 ? 'gmail.com' : 'yahoo.com'
  return `${slug}@${host}`
}

export function sampleCustomers(today: string, timeZone: string): Customer[] {
  const bookings = sampleBookings(today, timeZone)
  const grouped = new Map<string, Booking[]>()
  for (const booking of bookings) {
    const key = booking.customer_phone || booking.customer_name
    const rows = grouped.get(key) ?? []
    rows.push(booking)
    grouped.set(key, rows)
  }
  const now = new Date().toISOString()
  return [...grouped.entries()].map(([key, rows], index) => {
    const latest = [...rows].sort((a, b) => (b.selected_slot ?? '').localeCompare(a.selected_slot ?? ''))[0]
    const seen = latest.selected_slot || now
    return {
      id: `sample-customer-${index + 1}`,
      display_name: latest.customer_name,
      phone: latest.customer_phone,
      email: emailFor(latest.customer_name),
      primary_address: latest.customer_address,
      jobber_client_id: hash(key) % 3 === 0 ? `jobber_${1000 + index}` : null,
      notes: `Prefers morning visits. Last request: ${latest.service_type}.`,
      bookings_count: rows.length,
      last_seen_at: seen,
      last_booking_at: seen,
      created_at: rows[rows.length - 1]?.created_at || seen,
      updated_at: now,
    }
  }).sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''))
}

export function sampleCustomerDetail(id: string, today: string, timeZone: string): CustomerDetail | null {
  const customers = sampleCustomers(today, timeZone)
  const customer = customers.find((row) => row.id === id)
  if (!customer) return null
  const bookings = sampleBookings(today, timeZone).filter((row) => row.customer_phone === customer.phone)
  const channel = bookings[0]?.source_channel || 'call'
  return {
    ...customer,
    channel_identities: [
      {
        channel: channel === 'call' ? 'call' : channel,
        channel_account_id: channel === 'instagram' ? 'skyline.hvac' : 'skyline-hvac',
        external_id: customer.phone || customer.display_name,
      },
    ],
    bookings: bookings.map((row) => ({
      id: row.id,
      service_type: row.service_type,
      status: row.status,
      selected_slot: row.selected_slot,
      chat_summary: `${row.customer_name} asked to schedule ${row.service_type.toLowerCase()}.`,
      created_at: row.created_at,
    })),
  }
}

type ThreadLine = { role: 'user' | 'assistant'; text: string; hour: number; minute: number }

const SAMPLE_THREADS: {
  id: string
  channel: 'facebook' | 'instagram'
  name: string
  phone: string
  status: Conversation['status']
  daysAgo: number
  lines: ThreadLine[]
}[] = [
  {
    id: 'sample-thread-maria',
    channel: 'facebook',
    name: 'Maria Alvarez',
    phone: '(415) 555-0148',
    status: 'active',
    daysAgo: 0,
    lines: [
      { role: 'user', text: 'Hi, my furnace is blowing cold air this morning. Can someone come look at it?', hour: 8, minute: 12 },
      { role: 'assistant', text: 'Hi Maria, I can help with that. What city is the home in?', hour: 8, minute: 12 },
      { role: 'user', text: 'San Francisco, 1842 Chestnut St.', hour: 8, minute: 14 },
      { role: 'assistant', text: 'Thanks. I have Thursday at 9:00 AM or Friday at 1:30 PM for a furnace tune-up. Which works better?', hour: 8, minute: 14 },
      { role: 'user', text: 'Thursday at 9 is perfect.', hour: 8, minute: 16 },
      { role: 'assistant', text: 'You are booked for Thursday at 9:00 AM. A technician will text you when they are on the way.', hour: 8, minute: 16 },
    ],
  },
  {
    id: 'sample-thread-james',
    channel: 'facebook',
    name: 'James Whitfield',
    phone: '(628) 555-0172',
    status: 'active',
    daysAgo: 0,
    lines: [
      { role: 'user', text: 'No heat at all in the house. The thermostat is set to 70 and it is 61 inside.', hour: 9, minute: 4 },
      { role: 'assistant', text: 'That sounds like a no-heat call. Are you in San Francisco, and is anyone home this afternoon?', hour: 9, minute: 4 },
      { role: 'user', text: 'Yes, 90 Clayton St. I can be here after 1.', hour: 9, minute: 6 },
      { role: 'assistant', text: 'I held 1:30 PM today for a heat pump check. If the temperature drops further or you smell gas, leave and call 911.', hour: 9, minute: 7 },
      { role: 'user', text: 'No gas smell. 1:30 works. Thank you.', hour: 9, minute: 8 },
    ],
  },
  {
    id: 'sample-thread-priya',
    channel: 'instagram',
    name: 'Priya Shah',
    phone: '(415) 555-0194',
    status: 'active',
    daysAgo: 1,
    lines: [
      { role: 'user', text: 'Do you replace thermostats? Mine will not hold a schedule.', hour: 16, minute: 20 },
      { role: 'assistant', text: 'Yes. We install smart thermostats and the visit is usually about an hour. What neighborhood are you in?', hour: 16, minute: 21 },
      { role: 'user', text: 'Dolores Park. Can you do next Tuesday morning?', hour: 16, minute: 24 },
      { role: 'assistant', text: 'Tuesday at 10:00 AM is open. I will book the thermostat replacement at 55 Dolores St.', hour: 16, minute: 25 },
      { role: 'user', text: 'Great, please book it.', hour: 16, minute: 26 },
    ],
  },
  {
    id: 'sample-thread-daniel',
    channel: 'facebook',
    name: 'Daniel Okonkwo',
    phone: '(510) 555-0133',
    status: 'active',
    daysAgo: 1,
    lines: [
      { role: 'user', text: 'We just moved into a house in Berkeley and the vents are dusty. Do you clean ducts?', hour: 11, minute: 2 },
      { role: 'assistant', text: 'We do. A typical home takes one visit. What is the address?', hour: 11, minute: 3 },
      { role: 'user', text: '2210 Russell St.', hour: 11, minute: 5 },
      { role: 'assistant', text: 'I can do Monday at 3:00 PM. Want me to lock that in?', hour: 11, minute: 5 },
      { role: 'user', text: 'Yes please.', hour: 11, minute: 7 },
      { role: 'assistant', text: 'Booked. You will get a reminder the day before.', hour: 11, minute: 7 },
    ],
  },
  {
    id: 'sample-thread-amina',
    channel: 'instagram',
    name: 'Amina Farouk',
    phone: '(510) 555-0166',
    status: 'closed',
    daysAgo: 2,
    lines: [
      { role: 'user', text: 'The AC is running but the rooms never get cool.', hour: 13, minute: 40 },
      { role: 'assistant', text: 'I can send a tech to check the cooling. Are you in Oakland?', hour: 13, minute: 41 },
      { role: 'user', text: '88 Linda Ave. Tomorrow afternoon is best.', hour: 13, minute: 44 },
      { role: 'assistant', text: 'You are set for 2:00 PM. We will check the filter, coil, and refrigerant.', hour: 13, minute: 45 },
      { role: 'user', text: 'They came today and it is cooling again. Thank you.', hour: 18, minute: 10 },
      { role: 'assistant', text: 'Glad it is comfortable again. Message us if it warms back up.', hour: 18, minute: 12 },
    ],
  },
  {
    id: 'sample-thread-luis',
    channel: 'instagram',
    name: 'Luis Romero',
    phone: '(415) 555-0183',
    status: 'active',
    daysAgo: 3,
    lines: [
      { role: 'user', text: 'Can you come Saturday for duct cleaning? We have guests next week.', hour: 10, minute: 15 },
      { role: 'assistant', text: 'Saturday morning is open. What time should we arrive at 318 Jersey St?', hour: 10, minute: 16 },
      { role: 'user', text: '10:30 if you have it.', hour: 10, minute: 18 },
      { role: 'assistant', text: 'Saturday at 10:30 AM is reserved. See you then.', hour: 10, minute: 18 },
    ],
  },
]

export function sampleConversations(today: string, timeZone: string): Conversation[] {
  return SAMPLE_THREADS.map((thread) => {
    const day = shiftDateKey(today, -thread.daysAgo)
    const last = thread.lines[thread.lines.length - 1]
    const lastAt = wallTimeToIso(day, last.hour, last.minute, timeZone)
    const firstAt = wallTimeToIso(day, thread.lines[0].hour, thread.lines[0].minute, timeZone)
    return {
      id: thread.id,
      tenant_id: 'sample',
      channel: thread.channel,
      account_id: thread.channel === 'instagram' ? 'skyline.hvac' : 'skyline-hvac',
      channel_account_id: thread.channel === 'instagram' ? 'skyline.hvac' : 'skyline-hvac',
      customer_id: thread.id,
      customer_name: thread.name,
      customer_display_name: thread.name,
      customer_label_name: thread.name,
      customer_phone: thread.phone,
      customer_avatar_url: pagePhoto(thread.name, thread.channel === 'instagram' ? '9d174d' : '1d4ed8'),
      channel_account_label: thread.channel === 'instagram' ? '@skyline.hvac' : 'Skyline HVAC',
      intent: 'booking',
      status: thread.status,
      current_node: null,
      booking_id: null,
      created_at: firstAt,
      updated_at: lastAt,
      last_message_preview: last.text,
      last_message_role: last.role,
      last_message_at: lastAt,
    }
  }).sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
}

export function sampleThread(id: string, today: string, timeZone: string): Message[] {
  const thread = SAMPLE_THREADS.find((row) => row.id === id)
  if (!thread) return []
  const day = shiftDateKey(today, -thread.daysAgo)
  return thread.lines.map((line, index) => ({
    id: `${thread.id}-m${index + 1}`,
    conversation_id: thread.id,
    role: line.role,
    content: line.text,
    channel_message_id: null,
    created_at: wallTimeToIso(day, line.hour, line.minute + index, timeZone),
  }))
}

const SAMPLE_CALLS: {
  name: string
  phone: string
  daysAgo: number
  hour: number
  minute: number
  seconds: number
  cost: number
  bookings: number
  reason: string
  category: 'real_customer' | 'spam'
  direction?: 'inbound' | 'outbound'
}[] = [
  { name: 'Maria Alvarez', phone: '+14155550148', daysAgo: 0, hour: 8, minute: 40, seconds: 246, cost: 0.38, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'James Whitfield', phone: '+16285550172', daysAgo: 0, hour: 9, minute: 5, seconds: 318, cost: 0.51, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Robert Hale', phone: '+14155550104', daysAgo: 0, hour: 11, minute: 10, seconds: 194, cost: 0.29, bookings: 1, reason: 'assistant-ended-call', category: 'real_customer' },
  { name: 'Unknown caller', phone: '+18005550199', daysAgo: 0, hour: 12, minute: 2, seconds: 11, cost: 0.02, bookings: 0, reason: 'assistant-ended-call', category: 'spam' },
  { name: 'Helen Brooks', phone: '+14155550160', daysAgo: 1, hour: 10, minute: 15, seconds: 402, cost: 0.64, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Chris Nguyen', phone: '+16505550188', daysAgo: 1, hour: 14, minute: 22, seconds: 276, cost: 0.44, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Priya Shah', phone: '+14155550194', daysAgo: 1, hour: 16, minute: 48, seconds: 221, cost: 0.33, bookings: 1, reason: 'assistant-ended-call', category: 'real_customer' },
  { name: 'Kevin Marsh', phone: '+14155550190', daysAgo: 2, hour: 9, minute: 30, seconds: 355, cost: 0.57, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Lauren Peck', phone: '+16285550125', daysAgo: 2, hour: 13, minute: 5, seconds: 168, cost: 0.26, bookings: 0, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Sales desk', phone: '+18885550110', daysAgo: 2, hour: 15, minute: 40, seconds: 16, cost: 0.03, bookings: 0, reason: 'assistant-ended-call', category: 'spam' },
  { name: 'Omar Haddad', phone: '+16505550142', daysAgo: 3, hour: 8, minute: 50, seconds: 489, cost: 0.78, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Nina Patel', phone: '+14155550177', daysAgo: 3, hour: 15, minute: 12, seconds: 142, cost: 0.22, bookings: 0, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Emily Cho', phone: '+15105550198', daysAgo: 4, hour: 9, minute: 18, seconds: 260, cost: 0.41, bookings: 1, reason: 'assistant-ended-call', category: 'real_customer', direction: 'outbound' },
  { name: 'Andre Williams', phone: '+14155550121', daysAgo: 4, hour: 13, minute: 44, seconds: 305, cost: 0.48, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Rachel Stein', phone: '+16505550114', daysAgo: 5, hour: 10, minute: 6, seconds: 233, cost: 0.36, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Hannah Cole', phone: '+16285550155', daysAgo: 6, hour: 8, minute: 22, seconds: 510, cost: 0.82, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Grace Kim', phone: '+14155550169', daysAgo: 6, hour: 17, minute: 5, seconds: 188, cost: 0.3, bookings: 0, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Victor Alvarez', phone: '+16505550170', daysAgo: 8, hour: 11, minute: 28, seconds: 274, cost: 0.43, bookings: 1, reason: 'assistant-ended-call', category: 'real_customer' },
  { name: 'Natalie Brooks', phone: '+14155550128', daysAgo: 9, hour: 14, minute: 16, seconds: 341, cost: 0.55, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Diane Walsh', phone: '+15105550181', daysAgo: 11, hour: 9, minute: 47, seconds: 219, cost: 0.34, bookings: 1, reason: 'customer-ended-call', category: 'real_customer' },
  { name: 'Samir Rahman', phone: '+14155550196', daysAgo: 12, hour: 15, minute: 33, seconds: 156, cost: 0.24, bookings: 0, reason: 'customer-ended-call', category: 'real_customer', direction: 'outbound' },
  { name: 'Paul Ricci', phone: '+15105550174', daysAgo: 14, hour: 10, minute: 9, seconds: 298, cost: 0.47, bookings: 1, reason: 'assistant-ended-call', category: 'real_customer' },
]

export function sampleCallLogs(today: string, timeZone: string): CallLogSummary[] {
  return SAMPLE_CALLS.map((row, index) => {
    const day = shiftDateKey(today, -row.daysAgo)
    const started = wallTimeToIso(day, row.hour, row.minute, timeZone)
    const ended = new Date(new Date(started).getTime() + row.seconds * 1000).toISOString()
    return {
      id: `sample-call-${index + 1}`,
      vapi_call_id: `sky_${String(index + 1).padStart(3, '0')}`,
      direction: row.direction ?? 'inbound',
      status: 'ended',
      ended_reason: row.reason,
      phone_number: row.phone,
      caller_name: row.name === 'Unknown caller' || row.name === 'Sales desk' ? '' : row.name,
      assistant_id: 'skyline-receptionist',
      duration_seconds: row.seconds,
      cost: row.cost,
      has_recording: row.category === 'real_customer',
      has_transcript: true,
      started_at: started,
      ended_at: ended,
      created_at: started,
      updated_at: ended,
      bookings_count: row.bookings,
      call_category: row.category,
      quota_excluded: row.category === 'spam',
    }
  })
}

export function sampleCallDetail(id: string, today: string, timeZone: string): CallLogDetail | null {
  const call = sampleCallLogs(today, timeZone).find((row) => row.id === id)
  if (!call) return null
  const who = call.caller_name || 'The caller'
  return {
    ...call,
    recording_url: null,
    summary: call.bookings_count
      ? `${who} called about a heating or cooling visit. The assistant confirmed the address and booked the job.`
      : call.call_category === 'spam'
        ? 'Short sales call. The assistant ended it and the time was not billed.'
        : `${who} called with a question. No appointment was booked on this call.`,
    transcript: call.call_category === 'spam'
      ? 'Caller: Hi, this is a recorded offer about your warranty.\nAssistant: We do not take sales calls. Goodbye.'
      : `${who}: Hi, I need someone to look at the system.\nAssistant: I can help. What is the address?\n${who}: I can be home this week.\nAssistant: I have you on the schedule.`,
    metadata: {},
    bookings: [],
  }
}

function weekdayLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function sampleCallStats(period: 'week' | 'month', today: string, timeZone: string): CallStats {
  const start = period === 'week' ? shiftDateKey(today, -6) : `${today.slice(0, 8)}01`
  const days = eachDay(start, today)
  const counts = days.map((date, index) => {
    const weekend = weekday(date) === 0 || weekday(date) === 6
    const base = weekend ? 2 : 5
    const count = base + (hash(`${date}:vol`) % (weekend ? 2 : 4))
    return { date, label: weekdayLabel(date), count: period === 'month' && index % 6 === 0 ? Math.max(1, count - 2) : count }
  })
  const calls = counts.reduce((sum, row) => sum + row.count, 0)
  const jobs = Math.max(4, Math.round(calls * (period === 'week' ? 0.31 : 0.29)))
  const booked = jobs
  const afterHours = Math.round(calls * 0.24)
  const unbooked = Math.max(0, calls - booked)
  const value = jobs * 285
  const previousJobs = Math.max(1, jobs - (period === 'week' ? 3 : 6))
  const previousCalls = Math.max(jobs, calls - (period === 'week' ? 7 : 14))
  const previousValue = previousJobs * 285
  const conversion = Math.round((booked / calls) * 1000) / 10
  const previousConversion = Math.round((previousJobs / previousCalls) * 1000) / 10
  return {
    period,
    timezone: timeZone,
    current_start: `${start}T12:00:00.000Z`,
    current_end: `${today}T12:00:00.000Z`,
    previous_start: `${shiftDateKey(start, -(days.length))}T12:00:00.000Z`,
    previous_end: `${shiftDateKey(start, -1)}T12:00:00.000Z`,
    avg_job_value_fallback: 285,
    has_activity: true,
    current: {
      jobs_booked: jobs,
      estimated_value: value,
      calls_answered: calls,
      after_hours_calls: afterHours,
      unbooked_calls: unbooked,
      booked_calls: booked,
      conversion_pct: conversion,
      avg_call_duration_seconds: period === 'week' ? 214 : 198,
      total_talk_minutes: Math.round((calls * 3.4)),
      total_call_cost: Math.round(calls * 0.36),
    },
    previous: {
      jobs_booked: previousJobs,
      estimated_value: previousValue,
      calls_answered: previousCalls,
      after_hours_calls: Math.round(afterHours * 0.8),
      unbooked_calls: Math.max(0, previousCalls - previousJobs),
      booked_calls: previousJobs,
      conversion_pct: previousConversion,
      avg_call_duration_seconds: 186,
      total_talk_minutes: Math.round(previousCalls * 3.1),
      total_call_cost: Math.round(previousCalls * 0.34),
    },
    deltas: {
      jobs_booked: jobs - previousJobs,
      estimated_value: value - previousValue,
      calls_answered: calls - previousCalls,
      after_hours_calls: afterHours - Math.round(afterHours * 0.8),
      unbooked_calls: unbooked - Math.max(0, previousCalls - previousJobs),
      conversion_pct: Math.round((conversion - previousConversion) * 10) / 10,
      booked_calls: booked - previousJobs,
      total_talk_minutes: null,
      total_call_cost: null,
      calls_filtered: period === 'week' ? 2 : 4,
      minutes_saved: period === 'week' ? 1 : 2,
    },
    peak_hours: [],
    daily_volume: counts,
    call_categories: {
      real_customer: calls - (period === 'week' ? 4 : 9),
      spam: period === 'week' ? 3 : 6,
      wrong_number: 1,
      sales_call: period === 'week' ? 1 : 2,
      uncategorized: 0,
    },
    quota_protection: {
      calls_filtered: period === 'week' ? 4 : 9,
      minutes_saved: period === 'week' ? 1 : 3,
      by_category: {
        spam: period === 'week' ? 3 : 6,
        wrong_number: 1,
        sales_call: period === 'week' ? 1 : 2,
      },
    },
    bookings_by_status: {
      upcoming: Math.max(2, Math.round(jobs * 0.35)),
      completed: Math.max(2, Math.round(jobs * 0.55)),
      no_show: Math.max(0, jobs - Math.round(jobs * 0.35) - Math.round(jobs * 0.55)),
    },
  }
}

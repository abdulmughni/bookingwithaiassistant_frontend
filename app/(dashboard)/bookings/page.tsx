'use client'

import { useState } from 'react'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Divider } from '@/components/divider'
import { Card, CardBody } from '@/components/card'
import { useApiData, useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime, statusColor } from '@/lib/utils'
import type { Booking } from '@/lib/types'

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [phoneSearch, setPhoneSearch] = useState('')
  const [scheduleDateFrom, setScheduleDateFrom] = useState('')
  const [scheduleDateTo, setScheduleDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'box' | 'list'>('box')
  const getToken = useApiToken()

  const { data: bookings, loading, refetch } = useApiData<Booking[]>(
    (token) => api.bookings.list(token, statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  )

  const handleAction = async (
    id: string,
    action: 'cancel' | 'complete' | 'no-show',
  ) => {
    try {
      const token = await getToken()
      if (action === 'cancel') {
        await api.bookings.cancel(token, id)
        notifySuccess('Booking cancelled')
      } else if (action === 'complete') {
        await api.bookings.complete(token, id)
        notifySuccess('Marked as completed')
      } else {
        await api.bookings.noShow(token, id)
        notifySuccess('Marked as no-show')
      }
      refetch()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const displayBookings = bookings ?? []

  /** Calendar date (local) of appointment start — matches `<input type="date">` values. */
  const scheduledDayLocal = (booking: Booking): string | null => {
    const iso = booking.selected_slot
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const matchesScheduleRange = (booking: Booking) => {
    if (!scheduleDateFrom && !scheduleDateTo) return true
    const day = scheduledDayLocal(booking)
    if (!day) return false
    if (scheduleDateFrom && day < scheduleDateFrom) return false
    if (scheduleDateTo && day > scheduleDateTo) return false
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
  const hasActiveFilters = Boolean(phoneSearch || scheduleDateFrom || scheduleDateTo || statusFilter)
  const prettyStatus = (s: string) => s.replace('_', ' ')
  const prettySource = (s: string) => {
    const v = (s || '').toLowerCase()
    if (v === 'whatsapp') return 'WhatsApp'
    if (v === 'call') return 'Voice Call'
    if (v === 'api') return 'Dashboard/API'
    return v ? `${v.charAt(0).toUpperCase()}${v.slice(1)}` : 'Unknown'
  }
  const sourceBadgeColor = (s: string) => {
    const v = (s || '').toLowerCase()
    if (v === 'call') return 'purple'
    if (v === 'whatsapp') return 'lime'
    if (v === 'facebook') return 'blue'
    if (v === 'instagram') return 'pink'
    if (v === 'web') return 'zinc'
    return 'zinc'
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading>Bookings</Heading>
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
            {filteredBookings.map((booking) => (
              <Card
                key={booking.id}
                className="border border-zinc-200 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:hover:border-zinc-600"
              >
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-zinc-950 dark:text-white">
                        {booking.customer_name}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                        {booking.customer_phone}
                      </p>
                    </div>
                    <Badge color={statusColor(booking.status)}>
                      {prettyStatus(booking.status)}
                    </Badge>
                  </div>
                  <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Created {formatDateTime(booking.created_at)} · Updated {formatDateTime(booking.updated_at)}
                  </p>

                  <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/70">
                    <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Service
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {booking.service_type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Scheduled
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {booking.selected_slot ? formatDateTime(booking.selected_slot) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Source
                      </span>
                      <Badge color={sourceBadgeColor(booking.source_channel)}>
                        {prettySource(booking.source_channel)}
                      </Badge>
                    </div>
                    {booking.source_channel.toLowerCase() === 'call' && (
                      <div className="flex items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 dark:bg-zinc-900/50">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          From
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {booking.source_contact || booking.customer_phone || '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  {(booking.status === 'confirmed' || booking.status === 'rescheduled') && (
                    <div className="flex flex-wrap gap-2">
                      <Button plain className="text-xs" onClick={() => handleAction(booking.id, 'complete')}>
                        Complete
                      </Button>
                      <Button plain className="text-xs" onClick={() => handleAction(booking.id, 'no-show')}>
                        No-show
                      </Button>
                      <Button
                        plain
                        className="text-xs text-red-600 dark:text-red-400"
                        onClick={() => handleAction(booking.id, 'cancel')}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
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
              {filteredBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className="border border-zinc-200 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:hover:border-zinc-600"
                >
                  <CardBody className="p-0">
                    <div className="flex flex-col gap-3 p-4 xl:grid xl:grid-cols-[minmax(8rem,1.35fr)_minmax(7rem,1fr)_minmax(6rem,1fr)_auto_auto_minmax(8rem,1.15fr)_minmax(7rem,auto)] xl:items-center xl:gap-4 xl:p-3">
                      <div className="min-w-0 xl:border-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                          Customer
                        </p>
                        <p className="font-semibold text-zinc-950 dark:text-white">{booking.customer_name}</p>
                        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{booking.customer_phone}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                          Scheduled
                        </p>
                        <p className="whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                          {booking.selected_slot ? formatDateTime(booking.selected_slot) : '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                          Service
                        </p>
                        <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">{booking.service_type}</p>
                      </div>
                      <div className="flex items-center gap-2 xl:justify-center">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                          Source
                        </span>
                        <Badge color={sourceBadgeColor(booking.source_channel)}>
                          {prettySource(booking.source_channel)}
                        </Badge>
                      </div>
                      <div className="min-w-0 xl:text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
                          From
                        </p>
                        <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                          {booking.source_channel.toLowerCase() === 'call'
                            ? booking.source_contact || booking.customer_phone || '—'
                            : '—'}
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
                            Created {formatDateTime(booking.created_at)}
                            <br />
                            Updated {formatDateTime(booking.updated_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 border-t border-zinc-100 pt-3 xl:justify-end xl:border-t-0 xl:pt-0 dark:border-zinc-800">
                        {(booking.status === 'confirmed' || booking.status === 'rescheduled') && (
                          <>
                            <Button plain className="text-xs" onClick={() => handleAction(booking.id, 'complete')}>
                              Complete
                            </Button>
                            <Button plain className="text-xs" onClick={() => handleAction(booking.id, 'no-show')}>
                              No-show
                            </Button>
                            <Button
                              plain
                              className="text-xs text-red-600 dark:text-red-400"
                              onClick={() => handleAction(booking.id, 'cancel')}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {hasActiveFilters ? 'No bookings found for selected filters' : 'No bookings yet'}
          </p>
        )}
      </div>
    </>
  )
}

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
import { ApiError, api } from '@/lib/api'
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify'
import { formatDateTime, statusColor } from '@/lib/utils'
import type { Booking } from '@/lib/types'

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [phoneSearch, setPhoneSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Booking[] | null>(null)
  const getToken = useApiToken()

  const { data: bookings, loading, refetch } = useApiData<Booking[]>(
    (token) => api.bookings.list(token, statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  )

  const handlePhoneSearch = async () => {
    if (!phoneSearch.trim()) {
      setSearchResults(null)
      return
    }
    const token = await getToken()
    try {
      const results = await api.bookings.searchByPhone(token, phoneSearch)
      setSearchResults(results)
      if (results.length === 0) notifyInfo('No bookings found for that phone number')
    } catch (e) {
      setSearchResults([])
      notifyError(e instanceof ApiError ? e.message : 'Search failed')
    }
  }

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
      setSearchResults(null)
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Action failed')
    }
  }

  const displayBookings = searchResults ?? bookings ?? []
  const prettyStatus = (s: string) => s.replace('_', ' ')

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
              setSearchResults(null)
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
            onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
          />
          <Button onClick={handlePhoneSearch}>Search</Button>
        </div>
        {searchResults && (
          <Button
            plain
            onClick={() => {
              setSearchResults(null)
              setPhoneSearch('')
            }}
          >
            Clear search
          </Button>
        )}
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
        ) : displayBookings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayBookings.map((booking) => (
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

                  <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/70">
                    <p className="text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">Service:</span> {booking.service_type}
                    </p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">Scheduled:</span>{' '}
                      {booking.selected_slot ? formatDateTime(booking.selected_slot) : '—'}
                    </p>
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
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {searchResults ? 'No bookings found for this phone number' : 'No bookings yet'}
          </p>
        )}
      </div>
    </>
  )
}

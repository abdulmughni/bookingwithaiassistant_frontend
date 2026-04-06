'use client'

import { useState } from 'react'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Divider } from '@/components/divider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
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
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : displayBookings.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Customer</TableHeader>
                <TableHeader>Phone</TableHeader>
                <TableHeader>Service</TableHeader>
                <TableHeader>Scheduled</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    {booking.customer_name}
                  </TableCell>
                  <TableCell>{booking.customer_phone}</TableCell>
                  <TableCell>{booking.service_type}</TableCell>
                  <TableCell>
                    {booking.selected_slot
                      ? formatDateTime(booking.selected_slot)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge color={statusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {(booking.status === 'confirmed' ||
                        booking.status === 'rescheduled') && (
                        <>
                          <Button
                            plain
                            className="text-xs"
                            onClick={() =>
                              handleAction(booking.id, 'complete')
                            }
                          >
                            Complete
                          </Button>
                          <Button
                            plain
                            className="text-xs"
                            onClick={() =>
                              handleAction(booking.id, 'no-show')
                            }
                          >
                            No-show
                          </Button>
                        </>
                      )}
                      {(booking.status === 'confirmed' ||
                        booking.status === 'rescheduled') && (
                        <Button
                          plain
                          className="text-xs text-red-600"
                          onClick={() =>
                            handleAction(booking.id, 'cancel')
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {searchResults ? 'No bookings found for this phone number' : 'No bookings yet'}
          </p>
        )}
      </div>
    </>
  )
}

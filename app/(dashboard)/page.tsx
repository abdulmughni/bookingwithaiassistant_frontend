'use client'

import { useUser } from '@clerk/nextjs'
import { Heading, Subheading } from '@/components/heading'
import { Divider } from '@/components/divider'
import { Badge } from '@/components/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { useApiData } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDateTime, statusColor } from '@/lib/utils'
import type { TenantStats, Booking } from '@/lib/types'

function StatCard({
  label,
  value,
  change,
}: {
  label: string
  value: string | number
  change?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-950/5 p-6 dark:border-white/5">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
        {value}
      </p>
      {change && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {change}
        </p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()

  const { data: stats, loading: statsLoading } = useApiData<TenantStats>(
    (token) => api.tenants.stats(token),
  )

  const { data: upcoming, loading: upcomingLoading } = useApiData<Booking[]>(
    (token) => api.bookings.upcoming(token),
  )

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <>
      <Heading>
        {greeting()}, {user?.firstName || 'there'}
      </Heading>

      <Divider className="mt-6" />

      <Subheading className="mt-8">Overview</Subheading>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
            />
          ))
        ) : stats ? (
          <>
            <StatCard label="Total Bookings" value={stats.total_bookings} />
            <StatCard
              label="Confirmed"
              value={stats.confirmed_bookings}
            />
            <StatCard
              label="Active Conversations"
              value={stats.active_conversations}
            />
            <StatCard
              label="Channel Accounts"
              value={stats.total_channel_accounts}
            />
          </>
        ) : null}
      </div>

      <Subheading className="mt-10">Upcoming Appointments</Subheading>
      <div className="mt-4">
        {upcomingLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : upcoming && upcoming.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Customer</TableHeader>
                <TableHeader>Service</TableHeader>
                <TableHeader>Scheduled</TableHeader>
                <TableHeader>Status</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {upcoming.slice(0, 8).map((booking) => (
                <TableRow key={booking.id} href={`/bookings/${booking.id}`}>
                  <TableCell className="font-medium">
                    {booking.customer_name}
                  </TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No upcoming appointments
          </p>
        )}
      </div>
    </>
  )
}

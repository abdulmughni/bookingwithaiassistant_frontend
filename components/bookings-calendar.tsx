'use client'

import { useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import clsx from 'clsx'
import {
  bookingsToEvents,
  formatInTimeZone,
  slotWindowFromWorkingHours,
  toBusinessHours,
} from '@/lib/booking-calendar'
import type { Booking } from '@/lib/types'

export function BookingsCalendar({
  bookings,
  timeZone,
  workingHours,
  durationMinutes,
  onEventClick,
  onSlotSelect,
  className,
}: {
  bookings: Booking[]
  timeZone: string
  workingHours: Record<string, unknown> | null | undefined
  durationMinutes: number
  onEventClick: (booking: Booking) => void
  onSlotSelect: (startIsoLocal: string) => void
  className?: string
}) {
  const events: EventInput[] = useMemo(
    () => bookingsToEvents(bookings, durationMinutes),
    [bookings, durationMinutes],
  )
  const businessHours = useMemo(() => toBusinessHours(workingHours), [workingHours])
  const { slotMinTime, slotMaxTime } = useMemo(
    () => slotWindowFromWorkingHours(workingHours),
    [workingHours],
  )

  const hours = Math.floor(durationMinutes / 60)
  const mins = durationMinutes % 60
  const slotDuration = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`

  const handleEventClick = (info: EventClickArg) => {
    const booking = info.event.extendedProps.booking as Booking | undefined
    if (booking) onEventClick(booking)
  }

  const handleSelect = (info: DateSelectArg) => {
    onSlotSelect(formatInTimeZone(info.start, timeZone || 'UTC'))
    info.view.calendar.unselect()
  }

  return (
    <div
      className={clsx(
        'bookings-calendar rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-4',
        className,
      )}
    >
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        height="auto"
        contentHeight={720}
        timeZone={timeZone || 'local'}
        events={events}
        businessHours={businessHours.length > 0 ? businessHours : undefined}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        slotDuration={slotDuration}
        snapDuration={slotDuration}
        nowIndicator
        selectable
        selectMirror
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        dayMaxEvents
        weekends
        select={handleSelect}
        eventClick={handleEventClick}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
        }}
      />
    </div>
  )
}

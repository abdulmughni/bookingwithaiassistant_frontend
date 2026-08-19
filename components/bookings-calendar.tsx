'use client'

import { useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  DateSelectArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import {
  bookingsToEvents,
  formatInTimeZone,
  slotWindowFromWorkingHours,
  toBusinessHours,
} from '@/lib/booking-calendar'
import type { Booking } from '@/lib/types'

function TimeGridDayHeader({ arg }: { arg: DayHeaderContentArg }) {
  const tz = (arg.view.calendar.getOption('timeZone') as string | undefined) || undefined
  const weekday = arg.date.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: tz === 'local' ? undefined : tz,
  })
  const dayNum = arg.date.toLocaleDateString('en-US', {
    day: 'numeric',
    timeZone: tz === 'local' ? undefined : tz,
  })

  return (
    <div className="bc-day-head">
      <span className="bc-day-head__weekday">{weekday}</span>
      <span className={clsx('bc-day-head__num', arg.isToday && 'bc-day-head__num--today')}>
        {dayNum}
      </span>
    </div>
  )
}

function BookingEventContent({
  arg,
  onEdit,
}: {
  arg: EventContentArg
  onEdit?: (booking: Booking) => void
}) {
  const booking = arg.event.extendedProps.booking as Booking | undefined

  return (
    <div className="bc-event">
      {arg.timeText ? <div className="bc-event__time">{arg.timeText}</div> : null}
      <div className="bc-event__title">{arg.event.title}</div>
      {booking && onEdit ? (
        <button
          type="button"
          className="bc-event__edit"
          title="Edit booking"
          aria-label="Edit booking"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEdit(booking)
          }}
        >
          <PencilSquareIcon className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

export function BookingsCalendar({
  bookings,
  timeZone,
  workingHours,
  durationMinutes,
  onEventClick,
  onEventEdit,
  onSlotSelect,
  className,
}: {
  bookings: Booking[]
  timeZone: string
  workingHours: Record<string, unknown> | null | undefined
  durationMinutes: number
  onEventClick: (booking: Booking) => void
  onEventEdit?: (booking: Booking) => void
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
        'bookings-calendar overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/4',
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
        contentHeight={680}
        expandRows
        stickyHeaderDates
        timeZone={timeZone || 'local'}
        events={events}
        businessHours={businessHours.length > 0 ? businessHours : undefined}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        slotDuration={slotDuration}
        snapDuration={slotDuration}
        slotLabelInterval="01:00:00"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        allDaySlot={false}
        nowIndicator
        selectable
        selectMirror
        selectConstraint={businessHours.length > 0 ? 'businessHours' : undefined}
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        dayMaxEvents={4}
        weekends
        select={handleSelect}
        eventClick={handleEventClick}
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        eventContent={(arg) => <BookingEventContent arg={arg} onEdit={onEventEdit} />}
        dayHeaderContent={(arg) => {
          if (arg.view.type === 'dayGridMonth') {
            return arg.text
          }
          return <TimeGridDayHeader arg={arg} />
        }}
        views={{
          dayGridMonth: {
            dayHeaderFormat: { weekday: 'short' },
            titleFormat: { year: 'numeric', month: 'long' },
          },
          timeGridWeek: {
            titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
          },
          timeGridDay: {
            titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
          },
        }}
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

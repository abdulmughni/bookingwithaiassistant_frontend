'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  IdentificationIcon,
  MapPinIcon,
  PhoneIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { Dialog, DialogTitle } from '@/components/dialog'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { ChannelIcon, SourceBadge, channelLabel } from '@/components/channel-icon'
import { useApiToken, useTenantTimezone } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDateTime, formatRelativeTime, statusColor } from '@/lib/utils'
import type { Booking, BookingDetails, BookingMessagePreview } from '@/lib/types'

const prettyStatus = (s: string) => s.replace('_', ' ')

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${String(secs).padStart(2, '0')}s`
}

function MetaTile({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof PhoneIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-white/10 dark:bg-zinc-800/40">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{children}</div>
    </div>
  )
}

function MessageBubble({ message }: { message: BookingMessagePreview }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system' || message.role === 'tool'
  const text = (message.content || '').trim() || '—'
  const align = isUser ? 'items-start' : 'items-end'
  const bubble = isSystem
    ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    : isUser
      ? 'bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10'
      : 'bg-blue-600 text-white'
  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {isUser ? 'Customer' : isSystem ? message.role : 'Assistant'} ·{' '}
        {formatRelativeTime(message.created_at)}
      </span>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${bubble}`}>
        {text}
      </div>
    </div>
  )
}

export function BookingDetailsDialog({
  open,
  booking,
  onClose,
}: {
  open: boolean
  booking: Booking | null
  onClose: () => void
}) {
  const getToken = useApiToken()
  const tenantTz = useTenantTimezone()
  const [details, setDetails] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !booking) {
      setDetails(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const token = await getToken()
        const data = await api.bookings.details(token, booking.id)
        if (!cancelled) setDetails(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load booking details')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, booking, getToken])

  if (!booking) return null

  const data: Booking & Partial<BookingDetails> = details ?? booking
  const hasCall = Boolean(details?.call)
  const messages = details?.messages ?? []

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30">
          <IdentificationIcon
            className="h-5 w-5 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="mt-0! truncate">{data.customer_name}</DialogTitle>
            <Badge color={statusColor(data.status)}>{prettyStatus(data.status)}</Badge>
            <SourceBadge channel={data.source_channel} />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Booking ID <span className="font-mono">{data.id}</span> · created{' '}
            {formatDateTime(data.created_at, tenantTz)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* Summary */}
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
            Booking summary
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {loading && !data.chat_summary ? (
              <span className="text-zinc-500 dark:text-zinc-400">Building summary…</span>
            ) : data.chat_summary && data.chat_summary.trim() ? (
              data.chat_summary
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">
                No automatic summary yet — review the conversation below for context.
              </span>
            )}
          </p>
        </section>

        {/* Meta grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetaTile icon={CalendarDaysIcon} label="Scheduled">
            {data.selected_slot ? formatDateTime(data.selected_slot, tenantTz) : '—'}
          </MetaTile>
          <MetaTile icon={WrenchScrewdriverIcon} label="Service">
            {data.service_type || '—'}
          </MetaTile>
          <MetaTile icon={PhoneIcon} label="Phone">
            <span className="font-mono text-[13px]">{data.customer_phone || '—'}</span>
          </MetaTile>
          <MetaTile icon={MapPinIcon} label="Address">
            {data.customer_address || '—'}
          </MetaTile>
          <MetaTile icon={ChatBubbleLeftRightIcon} label="Conversation">
            {details?.conversation_channel ? (
              <span className="inline-flex items-center gap-1.5">
                <ChannelIcon channel={details.conversation_channel} />
                {channelLabel(details.conversation_channel)}
              </span>
            ) : (
              data.conversation_id || <span className="text-zinc-400">No linked chat</span>
            )}
            {details?.conversation_intent && (
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Intent: {details.conversation_intent}
              </span>
            )}
          </MetaTile>
          <MetaTile icon={ClockIcon} label="Last update">
            {formatDateTime(data.updated_at, tenantTz)}
          </MetaTile>
        </div>

        {/* Operator note + status timestamp */}
        {(data.status_note || data.status_changed_at) && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <ClipboardDocumentListIcon className="h-4 w-4" aria-hidden="true" />
              Operator note
            </div>
            {data.status_note ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {data.status_note}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No note recorded for this status change.
              </p>
            )}
            {data.status_changed_at && (
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Status set to{' '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {prettyStatus(data.status)}
                </span>{' '}
                {formatRelativeTime(data.status_changed_at)} ·{' '}
                {formatDateTime(data.status_changed_at, tenantTz)}
              </p>
            )}
          </section>
        )}

        {/* Booking notes (free-form) */}
        {data.notes && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Booking notes
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
              {data.notes}
            </p>
          </section>
        )}

        {/* Voice call */}
        {hasCall && details?.call && (
          <section className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 dark:border-purple-500/20 dark:bg-purple-500/5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                <PhoneIcon className="h-4 w-4" aria-hidden="true" />
                Linked voice call
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDuration(details.call.duration_seconds)} ·{' '}
                {details.call.started_at ? formatDateTime(details.call.started_at, tenantTz) : '—'}
              </span>
            </div>
            {details.call.summary && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                {details.call.summary}
              </p>
            )}
            {details.call.recording_url && (
              <audio
                controls
                preload="none"
                src={details.call.recording_url}
                className="mt-3 w-full"
              />
            )}
          </section>
        )}

        {/* Chat transcript */}
        <section className="rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            <ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
            Recent conversation {messages.length > 0 && <span>· {messages.length} messages</span>}
          </div>
          <div className="max-h-72 overflow-y-auto px-4 py-3">
            {loading && messages.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {data.conversation_id
                  ? 'No messages found for the linked conversation.'
                  : 'This booking is not linked to a chat conversation.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
            )}
          </div>
        </section>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="mt-8 flex justify-end gap-2">
        {data.confirmation_url && (
          <Button
            outline
            href={data.confirmation_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open calendar event
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  )
}

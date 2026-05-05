'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowPathIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TrashIcon,
  ChatBubbleBottomCenterTextIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/20/solid'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Card } from '@/components/card'
import { Divider } from '@/components/divider'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/components/dialog'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { useApiToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime } from '@/lib/utils'
import type { CallLogDetail, CallLogSummary } from '@/lib/types'

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type DirectionFilter = 'all' | 'inbound' | 'outbound' | 'web'
type StatusFilter = 'all' | 'ended' | 'in-progress' | 'queued' | 'ringing' | 'forwarding'

const DIRECTION_TABS: { id: DirectionFilter; label: string }[] = [
  { id: 'all', label: 'All calls' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'outbound', label: 'Outbound' },
  { id: 'web', label: 'Web' },
]

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Any status' },
  { id: 'ended', label: 'Ended' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'queued', label: 'Queued' },
  { id: 'ringing', label: 'Ringing' },
  { id: 'forwarding', label: 'Forwarding' },
]

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return '—'
  if (cost === 0) return '$0'
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

function statusColor(status: string): 'lime' | 'amber' | 'zinc' | 'red' | 'sky' {
  switch (status) {
    case 'ended':
      return 'lime'
    case 'in-progress':
    case 'ringing':
      return 'sky'
    case 'queued':
    case 'forwarding':
      return 'amber'
    default:
      return 'zinc'
  }
}

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  const cls = clsx('size-5', className)
  if (direction === 'outbound') return <PhoneArrowUpRightIcon className={cls} />
  if (direction === 'web') return <GlobeAltIcon className={cls} />
  return <PhoneArrowDownLeftIcon className={cls} />
}

function directionGradient(direction: string): string {
  if (direction === 'outbound') return 'linear-gradient(135deg, #2dd4bf, #0d9488)'
  if (direction === 'web') return 'linear-gradient(135deg, #818cf8, #4338ca)'
  return 'linear-gradient(135deg, #60a5fa, #2563eb)'
}

function callerLabel(call: CallLogSummary): string {
  if (call.phone_number) return call.phone_number
  if (call.direction === 'web') return 'Web visitor'
  return 'Unknown caller'
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CallsPage() {
  const PAGE_SIZE = 60

  const getToken = useApiToken()
  const [calls, setCalls] = useState<CallLogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState<number | null>(null)

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CallLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CallLogSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const listScrollRef = useRef<HTMLDivElement | null>(null)

  // Debounce free-text search so each keystroke doesn't hit the backend.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320)
    return () => clearTimeout(t)
  }, [query])

  const fetchCalls = useCallback(
    async (opts?: { reset?: boolean }) => {
      const reset = Boolean(opts?.reset)
      if (reset) {
        setLoading(true)
        setLoadingMore(false)
      } else {
        setLoadingMore(true)
      }
      try {
        const token = await getToken()
        const startAt = reset ? 0 : offset
        const page = await api.calls.listPaged(token, {
          limit: PAGE_SIZE,
          offset: startAt,
          direction: directionFilter === 'all' ? undefined : directionFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          q: debouncedQuery || undefined,
        })
        setCalls((prev) => {
          if (reset) return page.items
          const seen = new Set(prev.map((c) => c.id))
          const merged = [...prev]
          for (const item of page.items) {
            if (!seen.has(item.id)) merged.push(item)
          }
          return merged
        })
        setHasMore(page.has_more)
        setOffset(page.next_offset ?? startAt + page.items.length)
        setTotal(page.total)
      } catch (e) {
        notifyError(e instanceof ApiError ? e.message : 'Failed to load calls')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [debouncedQuery, directionFilter, getToken, offset, statusFilter],
  )

  // Reset list whenever filters / search change.
  useEffect(() => {
    setCalls([])
    setOffset(0)
    setHasMore(true)
    void fetchCalls({ reset: true })
    // We intentionally exclude offset/fetchCalls from deps — fetchCalls reads
    // the latest offset/state via its useCallback deps; we just need to react
    // to the filter trio changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, directionFilter, statusFilter])

  const refresh = async () => {
    setOffset(0)
    setHasMore(true)
    await fetchCalls({ reset: true })
  }

  // Virtualize the list — rows are ~120px tall; overscan keeps scroll smooth.
  const virtualizer = useVirtualizer({
    count: calls.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 124,
    overscan: 8,
  })
  const virtualRows = virtualizer.getVirtualItems()

  // Trigger pagination when we approach the end.
  useEffect(() => {
    const last = virtualRows[virtualRows.length - 1]
    if (!last) return
    if (!hasMore || loading || loadingMore) return
    if (last.index >= Math.max(0, calls.length - 8)) {
      void fetchCalls()
    }
  }, [virtualRows, calls.length, hasMore, loading, loadingMore, fetchCalls])

  // Detail dialog
  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const token = await getToken()
      const result = await api.calls.get(token, id)
      setDetail(result)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Failed to load call detail')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setDeleting(true)
    try {
      const token = await getToken()
      await api.calls.remove(token, id)
      notifySuccess('Call log deleted')
      if (selectedId === id) closeDetail()
      setPendingDelete(null)
      // Optimistically remove from current list, then refresh totals.
      setCalls((prev) => prev.filter((c) => c.id !== id))
      setTotal((t) => (t === null ? t : Math.max(0, t - 1)))
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Calls</Heading>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Voice calls handled by your Vapi assistant. Newest first.
          </p>
        </div>
        <Button outline onClick={refresh} disabled={loading}>
          <ArrowPathIcon data-slot="icon" className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <Divider className="mt-6" />

      {/* Filter bar */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {DIRECTION_TABS.map((tab) => {
            const active = directionFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDirectionFilter(tab.id)}
                className={clsx(
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:min-w-70">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search by phone, vapi call id, summary…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          {total !== null && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {total.toLocaleString()} {total === 1 ? 'call' : 'calls'}
            </span>
          )}
        </div>
      </div>

      {/* Virtualized list */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : calls.length > 0 ? (
          <div
            ref={listScrollRef}
            className="max-h-[calc(100vh-22rem)] overflow-y-auto pr-1"
          >
            <div
              className="relative"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((vr) => {
                const call = calls[vr.index]
                if (!call) return null
                return (
                  <div
                    key={call.id}
                    className="absolute left-0 top-0 w-full pb-3"
                    style={{ transform: `translateY(${vr.start}px)` }}
                  >
                    <CallCard
                      call={call}
                      onOpen={() => openDetail(call.id)}
                      onDelete={() => setPendingDelete(call)}
                    />
                  </div>
                )
              })}
            </div>

            <div className="px-3 py-3 text-center">
              {loadingMore ? (
                <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="size-3 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                  Loading more…
                </span>
              ) : hasMore ? (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  Scroll to load more
                </span>
              ) : (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  End of list
                </span>
              )}
            </div>
          </div>
        ) : (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div
                className="flex size-14 items-center justify-center rounded-full text-white"
                style={{ background: directionGradient('inbound') }}
                aria-hidden
              >
                <PhoneArrowDownLeftIcon className="size-7" />
              </div>
              <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                {query || directionFilter !== 'all' || statusFilter !== 'all'
                  ? 'No calls match your filters'
                  : 'No calls yet'}
              </p>
              <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                {query || directionFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try clearing the search or switching tabs.'
                  : 'Once your Vapi assistant takes its first call, it will appear here with full transcript and recording.'}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog size="3xl" open={!!selectedId} onClose={closeDetail}>
        <DialogTitle>Call detail</DialogTitle>
        <DialogBody>
          {detailLoading || !detail ? (
            <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <DetailField label="Direction" value={detail.direction} />
                <DetailField label="Status" value={detail.status} />
                <DetailField label="Caller" value={detail.phone_number || '—'} />
                <DetailField label="Duration" value={formatDuration(detail.duration_seconds)} />
                <DetailField label="Cost" value={formatCost(detail.cost)} />
                <DetailField label="Ended reason" value={detail.ended_reason || '—'} />
                <DetailField label="Started" value={formatDateTime(detail.started_at)} />
                <DetailField label="Ended" value={formatDateTime(detail.ended_at)} />
                <DetailField label="Vapi call id" value={detail.vapi_call_id} mono />
              </div>

              {detail.recording_url && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Recording
                  </h4>
                  <audio
                    controls
                    src={detail.recording_url}
                    className="mt-2 w-full"
                    preload="none"
                  />
                </div>
              )}

              {detail.summary && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">Summary</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {detail.summary}
                  </p>
                </div>
              )}

              {detail.transcript && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Transcript
                  </h4>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {detail.transcript}
                  </pre>
                </div>
              )}

              {!detail.recording_url && !detail.transcript && !detail.summary && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No transcript or recording available yet. Vapi sends those when the call ends.
                </p>
              )}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={closeDetail}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onClose={() => (deleting ? null : setPendingDelete(null))}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete this call log?"
        description="The Vapi-side recording is unaffected. This only removes the row from your dashboard. To confirm, delete the following call:"
        itemLabel={
          pendingDelete
            ? `${pendingDelete.phone_number || 'Web visitor'} · ${pendingDelete.vapi_call_id}`
            : undefined
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Card row
// ---------------------------------------------------------------------------

function CallCard({
  call,
  onOpen,
  onDelete,
}: {
  call: CallLogSummary
  onOpen: () => void
  onDelete: () => void
}) {
  const directionLabel =
    call.direction === 'outbound'
      ? 'Outbound'
      : call.direction === 'web'
        ? 'Web call'
        : 'Inbound'

  return (
    <Card className="group transition-all hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-sky-400/40"
      >
        <div className="flex items-start gap-4 p-5">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
            style={{ background: directionGradient(call.direction) }}
            aria-hidden
          >
            <DirectionIcon direction={call.direction} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="truncate text-base font-semibold text-zinc-900 dark:text-white">
                {callerLabel(call)}
              </p>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {formatDateTime(call.started_at) || formatDateTime(call.created_at)}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {directionLabel}
              </span>
              <Badge color={statusColor(call.status)}>{call.status}</Badge>
              {call.ended_reason && (
                <span className="text-[11px] text-zinc-400">
                  · {call.ended_reason}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3.5 text-zinc-400" />
                {formatDuration(call.duration_seconds)}
              </span>
              <span className="inline-flex items-center gap-1">
                <CurrencyDollarIcon className="size-3.5 text-zinc-400" />
                {formatCost(call.cost)}
              </span>
              {call.has_recording && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <SpeakerWaveIcon className="size-3.5" />
                  Recording
                </span>
              )}
              {call.has_transcript && (
                <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                  <ChatBubbleBottomCenterTextIcon className="size-3.5" />
                  Transcript
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-end gap-1 border-t border-zinc-950/5 px-3 py-2 dark:border-white/5">
        <Button plain className="text-xs" onClick={onOpen}>
          Open details
        </Button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          aria-label="Delete call log"
        >
          <TrashIcon className="size-3.5" />
          Delete
        </button>
      </div>
    </Card>
  )
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={
          'mt-1 text-sm text-zinc-950 dark:text-white ' +
          (mono ? 'font-mono break-all' : 'capitalize')
        }
      >
        {value}
      </dd>
    </div>
  )
}

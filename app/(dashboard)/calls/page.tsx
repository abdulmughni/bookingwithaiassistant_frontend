'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon,
  GlobeAltIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TrashIcon,
  ChatBubbleBottomCenterTextIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/20/solid'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Card, CardBody } from '@/components/card'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
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
// Filters (mirror bookings UX — selects + date range + clear + box/list views)
// ---------------------------------------------------------------------------

type DirectionFilter = 'all' | 'inbound' | 'outbound' | 'web'
type StatusFilter = 'all' | 'ended' | 'in-progress' | 'queued' | 'ringing' | 'forwarding'

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

function directionDisplayLabel(direction: string): string {
  if (direction === 'outbound') return 'Outbound'
  if (direction === 'web') return 'Web call'
  return 'Inbound'
}

/** Primary caller line: name and phone when both exist; otherwise whichever is present. */
function callerPrimaryLine(call: CallLogSummary): string {
  const name = (call.caller_name || '').trim()
  const phone = (call.phone_number || '').trim()
  if (name && phone) return `${name} · ${phone}`
  if (name) return name
  if (phone) return phone
  if (call.direction === 'web') return 'Web visitor'
  return 'Unknown caller'
}

function whenLabel(call: CallLogSummary): string {
  return formatDateTime(call.started_at) || formatDateTime(call.created_at)
}

/** Page size for Calls list — kept in sync with API default (`GET /calls/paged`). */
const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CallsPage() {
  const getToken = useApiToken()
  const [calls, setCalls] = useState<CallLogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [callDateFrom, setCallDateFrom] = useState('')
  const [callDateTo, setCallDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'box' | 'list'>('box')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CallLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CallLogSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const callsTopRef = useRef<HTMLDivElement | null>(null)
  const prevFilterKeyRef = useRef<string>('')
  const lastRequestedRef = useRef<{ fk: string; p: number } | null>(null)

  const filterKey = useMemo(
    () =>
      [debouncedQuery, directionFilter, statusFilter, callDateFrom, callDateTo].join('\u0001'),
    [debouncedQuery, directionFilter, statusFilter, callDateFrom, callDateTo],
  )

  const hasActiveFilters =
    Boolean(debouncedQuery) ||
    directionFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(callDateFrom) ||
    Boolean(callDateTo)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320)
    return () => clearTimeout(t)
  }, [query])

  const loadCalls = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      try {
        const token = await getToken()
        const data = await api.calls.listPaged(token, {
          limit: PAGE_SIZE,
          offset: (targetPage - 1) * PAGE_SIZE,
          direction: directionFilter === 'all' ? undefined : directionFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          q: debouncedQuery || undefined,
          started_from: callDateFrom || undefined,
          started_to: callDateTo || undefined,
        })
        setCalls(data.items)
        setTotal(data.total)
        const totalPages = Math.max(1, Math.ceil(Math.max(data.total, 0) / PAGE_SIZE))
        if (targetPage > totalPages) {
          lastRequestedRef.current = null
          setPage(totalPages)
        }
      } catch (e) {
        notifyError(e instanceof ApiError ? e.message : 'Failed to load calls')
      } finally {
        setLoading(false)
      }
    },
    [debouncedQuery, directionFilter, statusFilter, callDateFrom, callDateTo, getToken],
  )

  useEffect(() => {
    const filtersChanged = prevFilterKeyRef.current !== filterKey
    prevFilterKeyRef.current = filterKey

    const targetPage = filtersChanged ? 1 : page
    if (filtersChanged && page !== 1) {
      setPage(1)
    }

    const last = lastRequestedRef.current
    if (last && last.fk === filterKey && last.p === targetPage) {
      return
    }
    lastRequestedRef.current = { fk: filterKey, p: targetPage }

    void loadCalls(targetPage)
  }, [filterKey, page, loadCalls])

  const skipPaginationScrollRef = useRef(true)
  useEffect(() => {
    if (loading) return
    if (skipPaginationScrollRef.current) {
      skipPaginationScrollRef.current = false
      return
    }
    callsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [page, loading])

  const refresh = () => {
    lastRequestedRef.current = null
    void loadCalls(page)
  }

  const totalPages = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))

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
    const soleRowOnPage = calls.length === 1
    const curPage = page
    setDeleting(true)
    try {
      const token = await getToken()
      await api.calls.remove(token, id)
      notifySuccess('Call log deleted')
      if (selectedId === id) closeDetail()
      setPendingDelete(null)
      setCalls((prev) => prev.filter((c) => c.id !== id))
      setTotal((t) => (t === null ? t : Math.max(0, t - 1)))
      if (soleRowOnPage && curPage > 1) {
        lastRequestedRef.current = null
        setPage((p) => p - 1)
      }
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const clearFilters = () => {
    setDirectionFilter('all')
    setStatusFilter('all')
    setQuery('')
    setCallDateFrom('')
    setCallDateTo('')
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
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

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
            aria-label="Filter by direction"
          >
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="web">Web</option>
          </Select>
        </div>

        <div className="w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">Any status</option>
            <option value="ended">Ended</option>
            <option value="in-progress">In progress</option>
            <option value="queued">Queued</option>
            <option value="ringing">Ringing</option>
            <option value="forwarding">Forwarding</option>
          </Select>
        </div>

        <div className="min-w-56 flex-1">
          <Input
            placeholder="Search name, phone, Vapi id, assistant id, summary…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Call date from
            </label>
            <Input
              type="date"
              value={callDateFrom}
              onChange={(e) => setCallDateFrom(e.target.value)}
              title="Call calendar day on or after (started time, else created)"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Call date to
            </label>
            <Input
              type="date"
              value={callDateTo}
              onChange={(e) => setCallDateTo(e.target.value)}
              title="Call calendar day on or before"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <Button plain type="button" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <div className="ml-auto inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          <Button
            plain
            type="button"
            className={`px-3 py-1 text-xs ${viewMode === 'box' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            onClick={() => setViewMode('box')}
          >
            Box view
          </Button>
          <Button
            plain
            type="button"
            className={`px-3 py-1 text-xs ${viewMode === 'list' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List view
          </Button>
        </div>

        {total !== null && (
          <span className="w-full text-xs text-zinc-500 sm:w-auto dark:text-zinc-400">
            {total.toLocaleString()} {total === 1 ? 'call' : 'calls'} · {PAGE_SIZE} per page
          </span>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          viewMode === 'box' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-29.5 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
                />
              ))}
            </div>
          )
        ) : calls.length > 0 ? (
          <>
            <div
              ref={callsTopRef}
              className="max-h-[calc(100vh-26rem)] overflow-y-auto scroll-smooth pr-1 sm:max-h-[calc(100vh-22rem)]"
            >
              <div key={viewMode} className="bookings-layout-animate">
                {viewMode === 'box' ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {calls.map((call) => (
                      <CallGridCard
                        key={call.id}
                        call={call}
                        onOpen={() => openDetail(call.id)}
                        onDelete={() => setPendingDelete(call)}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="mb-2 hidden rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:grid xl:grid-cols-[minmax(6rem,1.35fr)_minmax(7rem,1fr)_auto_auto_minmax(9rem,1.15fr)_minmax(8rem,auto)] xl:gap-4 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
                      <span>Caller</span>
                      <span>When</span>
                      <span className="text-center">Direction</span>
                      <span className="text-center">Meta</span>
                      <span>Status</span>
                      <span className="text-right">Actions</span>
                    </div>
                    <div className="space-y-3">
                      {calls.map((call) => (
                        <CallListRow
                          key={call.id}
                          call={call}
                          onOpen={() => openDetail(call.id)}
                          onDelete={() => setPendingDelete(call)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <CallsPagination
              page={page}
              totalPages={totalPages}
              totalItems={total ?? 0}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
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
                {hasActiveFilters ? 'No calls match your filters' : 'No calls yet'}
              </p>
              <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                {hasActiveFilters
                  ? 'Try clearing filters or widening the call date range.'
                  : 'Once your Vapi assistant takes its first call, it will appear here with full transcript and recording.'}
              </p>
            </div>
          </Card>
        )}
      </div>

      <Dialog size="4xl" open={!!selectedId} onClose={closeDetail}>
        {detailLoading || !detail ? (
          <>
            <DialogTitle>Call detail</DialogTitle>
            <DialogBody className="space-y-6">
              <CallDetailSkeleton />
            </DialogBody>
          </>
        ) : (
          <DialogBody className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-linear-to-br from-zinc-50 via-white to-sky-50/50 p-5 shadow-sm ring-1 ring-zinc-950/3 dark:border-zinc-700/90 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/35 dark:ring-white/4">
              <div
                className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-linear-to-br from-sky-400/15 to-indigo-500/10 blur-2xl dark:from-sky-500/10 dark:to-indigo-600/5"
                aria-hidden
              />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-white/70 dark:ring-zinc-950/60"
                  style={{ background: directionGradient(detail.direction) }}
                  aria-hidden
                >
                  <DirectionIcon direction={detail.direction} className="size-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Voice call
                  </p>
                  <DialogTitle className="mt-1 text-pretty text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl/8 dark:text-white">
                    {callerPrimaryLine(detail)}
                  </DialogTitle>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge color={statusColor(detail.status)}>{detail.status}</Badge>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-950/5 backdrop-blur-sm dark:bg-zinc-800/90 dark:text-zinc-200 dark:ring-white/10">
                      <DirectionIcon direction={detail.direction} className="size-3.5 text-zinc-500 dark:text-zinc-400" />
                      {directionDisplayLabel(detail.direction)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {whenLabel(detail)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailStat label="Direction" value={directionDisplayLabel(detail.direction)} />
              <DetailStat label="Status" value={detail.status} />
              <DetailStat label="Duration" value={formatDuration(detail.duration_seconds)} />
              <DetailStat label="Cost" value={formatCost(detail.cost)} />
              <DetailStat label="Ended reason" value={detail.ended_reason || '—'} capitalize={false} />
              <DetailStat label="Started" value={formatDateTime(detail.started_at)} capitalize={false} />
              <DetailStat label="Ended" value={formatDateTime(detail.ended_at)} capitalize={false} />
              <DetailStat label="Vapi call id" value={detail.vapi_call_id} mono />
            </div>

            {detail.recording_url && (
              <section className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-linear-to-br from-emerald-50/90 via-white to-teal-50/40 shadow-sm dark:border-emerald-900/35 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/25">
                <div className="flex items-center gap-2 border-b border-emerald-200/50 px-4 py-3 dark:border-emerald-900/40">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    <SpeakerWaveIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Recording</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Play when the call has finished processing</p>
                  </div>
                </div>
                <div className="p-4 pt-3">
                  <audio
                    controls
                    src={detail.recording_url}
                    className="h-11 w-full accent-emerald-600 dark:accent-emerald-500"
                    preload="none"
                  />
                </div>
              </section>
            )}

            {detail.summary && (
              <section className="rounded-2xl border border-sky-200/70 bg-linear-to-b from-sky-50/80 to-white px-4 py-4 shadow-sm dark:border-sky-900/35 dark:from-sky-950/35 dark:to-zinc-900/80">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                    <ChatBubbleBottomCenterTextIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Summary</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {detail.summary}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {detail.transcript && (
              <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-700/90 dark:bg-zinc-950/50">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/90">
                  <div className="flex items-center gap-2">
                    <ChatBubbleBottomCenterTextIcon className="size-4 text-zinc-500 dark:text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Transcript</h3>
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Full text
                  </span>
                </div>
                <pre className="max-h-[min(26rem,55vh)] overflow-auto whitespace-pre-wrap bg-zinc-50/50 p-4 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                  {detail.transcript}
                </pre>
              </section>
            )}

            {!detail.recording_url && !detail.transcript && !detail.summary && (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <ChatBubbleBottomCenterTextIcon className="size-6" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  No recording or transcript yet
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                  Vapi usually attaches the recording, summary, and transcript after the call ends.
                </p>
              </div>
            )}
          </DialogBody>
        )}
        <DialogActions className="border-t border-zinc-950/5 pt-6 dark:border-white/10">
          <Button outline onClick={closeDetail}>
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
            ? `${callerPrimaryLine(pendingDelete)} · ${pendingDelete.vapi_call_id}`
            : undefined
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function visiblePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  if (current - 2 > 1) pages.add(current - 2)
  if (current + 2 < total) pages.add(current + 2)
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}

function CallsPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  disabled,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (p: number) => void
  disabled?: boolean
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)
  const pages = visiblePageNumbers(page, totalPages)

  return (
    <div className="mt-6 flex flex-col items-stretch justify-between gap-4 border-t border-zinc-950/5 pt-6 sm:flex-row sm:items-center dark:border-white/10">
      <p className="text-center text-sm text-zinc-500 sm:text-left dark:text-zinc-400">
        {totalItems === 0 ? (
          'No calls on this page'
        ) : (
          <>
            Showing{' '}
            <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{start}</span>
            {'–'}
            <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{end}</span>
            {' of '}
            <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
              {totalItems.toLocaleString()}
            </span>
            <span className="hidden sm:inline">
              {' '}
              · Page{' '}
              <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{page}</span> of{' '}
              <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{totalPages}</span>
            </span>
          </>
        )}
      </p>

      <nav
        className="flex flex-wrap items-center justify-center gap-1 sm:justify-end"
        aria-label="Call list pagination"
      >
        <Button
          outline
          type="button"
          className="gap-1 px-2.5 py-2 text-xs sm:px-3"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon data-slot="icon" className="size-4" />
          Previous
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-1 px-1">
          {pages.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`e-${idx}`}
                className="px-2 text-sm font-medium text-zinc-400 dark:text-zinc-500"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                className={clsx(
                  'min-w-9 rounded-lg px-3 py-2 text-xs font-semibold transition',
                  item === page
                    ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <Button
          outline
          type="button"
          className="gap-1 px-2.5 py-2 text-xs sm:px-3"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRightIcon data-slot="icon" className="size-4" />
        </Button>
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Box card (grid)
// ---------------------------------------------------------------------------

function CallGridCard({
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
                {callerPrimaryLine(call)}
              </p>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {whenLabel(call)}
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

            <p className="mt-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              Created {formatDateTime(call.created_at)}
              <br />
              Updated {formatDateTime(call.updated_at)}
            </p>

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

// ---------------------------------------------------------------------------
// List row (one horizontal strip — not a table)
// ---------------------------------------------------------------------------

function CallListRow({
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
        ? 'Web'
        : 'Inbound'

  return (
    <Card className="overflow-hidden border border-zinc-200 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:hover:border-zinc-600">
      <CardBody className="p-0">
        <div className="flex flex-col gap-3 p-4 xl:grid xl:grid-cols-[minmax(6rem,1.35fr)_minmax(7rem,1fr)_auto_auto_minmax(9rem,1.15fr)_minmax(8rem,auto)] xl:items-center xl:gap-4 xl:p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
              Caller
            </p>
            <p className="truncate font-semibold text-zinc-950 dark:text-white">{callerPrimaryLine(call)}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{call.vapi_call_id}</p>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
              When
            </p>
            <p className="whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">{whenLabel(call)}</p>
          </div>

          <div className="flex items-center gap-2 xl:justify-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
              Direction
            </p>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
              style={{ background: directionGradient(call.direction) }}
              aria-hidden
            >
              <DirectionIcon direction={call.direction} className="size-4" />
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{directionLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 xl:justify-center dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {formatDuration(call.duration_seconds)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CurrencyDollarIcon className="size-3.5" />
              {formatCost(call.cost)}
            </span>
            {call.has_recording && (
              <span className="inline-flex text-emerald-600 dark:text-emerald-400" aria-label="Has recording">
                <SpeakerWaveIcon className="size-4" />
              </span>
            )}
            {call.has_transcript && (
              <span className="inline-flex text-sky-600 dark:text-sky-400" aria-label="Has transcript">
                <ChatBubbleBottomCenterTextIcon className="size-4" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:hidden dark:text-zinc-400">
              Status
            </p>
            <div className="flex flex-col items-start gap-1">
              <Badge color={statusColor(call.status)}>{call.status}</Badge>
              <span className="max-w-56 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                Created {formatDateTime(call.created_at)}
                <br />
                Updated {formatDateTime(call.updated_at)}
              </span>
              {call.ended_reason && (
                <span className="text-[11px] text-zinc-400">{call.ended_reason}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 border-t border-zinc-100 pt-3 xl:justify-end xl:border-t-0 xl:pt-0 dark:border-zinc-800">
            <Button plain className="text-xs" onClick={onOpen}>
              Details
            </Button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <TrashIcon className="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function DetailStat({
  label,
  value,
  mono = false,
  capitalize = true,
}: {
  label: string
  value: string
  mono?: boolean
  capitalize?: boolean
}) {
  return (
    <div className="rounded-xl border border-zinc-200/75 bg-linear-to-br from-white to-zinc-50/90 px-4 py-3.5 shadow-sm dark:border-zinc-700/75 dark:from-zinc-900/90 dark:to-zinc-950/90 dark:shadow-none">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={clsx(
          'mt-1.5 text-sm font-medium leading-snug text-zinc-950 dark:text-zinc-100',
          mono && 'break-all font-mono text-[13px]',
          capitalize && !mono && 'capitalize',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function CallDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="size-16 shrink-0 rounded-2xl bg-zinc-200 dark:bg-zinc-700" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-7 w-4/5 max-w-md rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-6 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-17 rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
          />
        ))}
      </div>
    </div>
  )
}

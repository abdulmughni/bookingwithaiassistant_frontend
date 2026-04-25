'use client'

import { useState } from 'react'
import {
  ArrowPathIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon,
  GlobeAltIcon,
} from '@heroicons/react/20/solid'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Divider } from '@/components/divider'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/components/dialog'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
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
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDateTime } from '@/lib/utils'
import type { CallLogDetail, CallLogSummary } from '@/lib/types'

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return '—'
  return `$${cost.toFixed(4)}`
}

function statusColor(status: string): 'lime' | 'amber' | 'zinc' | 'red' | 'sky' {
  switch (status) {
    case 'ended':
      return 'lime'
    case 'in-progress':
    case 'ringing':
      return 'sky'
    case 'queued':
      return 'amber'
    case 'forwarding':
      return 'amber'
    default:
      return 'zinc'
  }
}

function DirectionIcon({ direction }: { direction: string }) {
  const cls = 'size-4 text-zinc-500'
  if (direction === 'outbound') return <PhoneArrowUpRightIcon className={cls} />
  if (direction === 'web') return <GlobeAltIcon className={cls} />
  return <PhoneArrowDownLeftIcon className={cls} />
}

export default function CallsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CallLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CallLogSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const getToken = useApiToken()

  const { data: calls, loading, refetch } = useApiData<CallLogSummary[]>(
    (token) => api.calls.list(token, { limit: 100 }),
    [],
  )

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
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading>Calls</Heading>
        <Button outline onClick={refetch} disabled={loading}>
          <ArrowPathIcon data-slot="icon" className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6">
        {loading ? (
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : calls && calls.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Direction</TableHeader>
                <TableHeader>Caller</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Duration</TableHeader>
                <TableHeader>Cost</TableHeader>
                <TableHeader>Started</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DirectionIcon direction={call.direction} />
                      <span className="capitalize">{call.direction}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {call.phone_number || (call.direction === 'web' ? 'Web visitor' : '—')}
                  </TableCell>
                  <TableCell>
                    <Badge color={statusColor(call.status)}>{call.status}</Badge>
                    {call.ended_reason && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {call.ended_reason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                  <TableCell>{formatCost(call.cost)}</TableCell>
                  <TableCell>{formatDateTime(call.started_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button plain className="text-xs" onClick={() => openDetail(call.id)}>
                        Details
                      </Button>
                      <Button
                        plain
                        className="text-xs text-red-600"
                        onClick={() => setPendingDelete(call)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No calls yet. Once your Vapi assistant receives or makes a call, it will appear here.
          </p>
        )}
      </div>

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
                  <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {detail.summary}
                  </p>
                </div>
              )}

              {detail.transcript && (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Transcript
                  </h4>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-zinc-50 p-4 text-xs whitespace-pre-wrap text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
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

'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog'
import { formatDate, formatDateTime } from '@/components/admin/shared'
import { PageHeader, PageShell, dashCardClass } from '@/components/dashboard-ui'
import { api, ApiError } from '@/lib/api'
import { useApiData, useApiToken } from '@/lib/hooks'
import type { AdminPlanChangeRequest } from '@/lib/types'

const STATUS_COLOR: Record<AdminPlanChangeRequest['status'], 'amber' | 'green' | 'zinc'> = {
  open: 'amber',
  resolved: 'green',
  dismissed: 'zinc',
}

export default function AdminRequestsPage() {
  const getToken = useApiToken()
  const [showResolved, setShowResolved] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    request: AdminPlanChangeRequest
    status: 'resolved' | 'dismissed'
  } | null>(null)

  const {
    data: requests,
    error,
    refetch: load,
  } = useApiData(
    (token) => api.admin.listRequests(token, showResolved ? undefined : 'open'),
    [showResolved],
  )

  const resolve = useCallback(
    async (id: string, status: 'resolved' | 'dismissed') => {
      try {
        const token = await getToken()
        await api.admin.resolveRequest(token, id, status)
        toast.success(status === 'resolved' ? 'Request resolved.' : 'Request dismissed.')
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Action failed.')
      }
    },
    [getToken, load],
  )

  return (
    <PageShell>
      <PageHeader
        title="Plan change requests"
        description="Clients can't switch plans themselves — they submit a request. Apply the plan from the client's detail page, then resolve the request here."
      >
        <Button outline onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? 'Show open only' : 'Show all'}
        </Button>
        <Button outline onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className={dashCardClass}>
        <div className="px-2 sm:px-4">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Client</TableHeader>
                <TableHeader>Requested plan</TableHeader>
                <TableHeader>Message</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Submitted</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests === null && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {requests?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    {showResolved ? 'No requests yet.' : 'No open requests. All caught up.'}
                  </TableCell>
                </TableRow>
              )}
              {requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/clients/${encodeURIComponent(r.tenant_id)}`}
                      className="font-medium text-zinc-950 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
                    >
                      {r.tenant_name ?? r.tenant_id}
                    </Link>
                    <div className="font-mono text-xs text-zinc-400">{r.tenant_id}</div>
                  </TableCell>
                  <TableCell>
                    {r.requested_plan_id ?? <span className="text-zinc-400">No preference</span>}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-zinc-600 dark:text-zinc-300">
                    {r.message || <span className="text-zinc-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'open' ? (
                        <>
                          <Button
                            color="green"
                            onClick={() => setConfirmAction({ request: r, status: 'resolved' })}
                          >
                            Resolve
                          </Button>
                          <Button
                            outline
                            onClick={() => setConfirmAction({ request: r, status: 'dismissed' })}
                          >
                            Dismiss
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {formatDate(r.resolved_at)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.status === 'resolved'
            ? 'Mark this request as resolved?'
            : 'Dismiss this request?'
        }
        description={
          confirmAction?.status === 'resolved'
            ? `Confirm you've already applied the plan change for ${
                confirmAction?.request.tenant_name ?? 'this client'
              } from their detail page. The request will be closed.`
            : `The request from ${
                confirmAction?.request.tenant_name ?? 'this client'
              } will be closed without any plan change.`
        }
        confirmLabel={confirmAction?.status === 'resolved' ? 'Yes, resolve' : 'Yes, dismiss'}
        busyLabel="Working…"
        color={confirmAction?.status === 'resolved' ? 'green' : 'dark/zinc'}
        onConfirm={async () => {
          if (confirmAction) {
            await resolve(confirmAction.request.id, confirmAction.status)
          }
        }}
      />
    </PageShell>
  )
}

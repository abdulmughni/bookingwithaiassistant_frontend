'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { PageHeader, PageShell, dashCardClass } from '@/components/dashboard-ui'
import { api, ApiError } from '@/lib/api'
import { useApiToken } from '@/lib/hooks'
import type { AdminPlanChangeRequest } from '@/lib/types'

const STATUS_COLOR: Record<AdminPlanChangeRequest['status'], 'amber' | 'green' | 'zinc'> = {
  open: 'amber',
  resolved: 'green',
  dismissed: 'zinc',
}

export default function AdminRequestsPage() {
  const getToken = useApiToken()
  const [requests, setRequests] = useState<AdminPlanChangeRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const rows = await api.admin.listRequests(token, showResolved ? undefined : 'open')
      setRequests(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load requests.')
    }
  }, [getToken, showResolved])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = useCallback(
    async (id: string, status: 'resolved' | 'dismissed') => {
      if (busyId) return
      setBusyId(id)
      try {
        const token = await getToken()
        await api.admin.resolveRequest(token, id, status)
        toast.success(`Request ${status}.`)
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Action failed.')
      } finally {
        setBusyId(null)
      }
    },
    [busyId, getToken, load],
  )

  return (
    <PageShell>
      <PageHeader
        title="Plan change requests"
        description="Clients can't switch plans themselves — they submit a request here. Apply the change from the Tenants tab, then resolve the request."
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
                <TableHeader>Tenant</TableHeader>
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
                  <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {requests?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                    No requests.
                  </TableCell>
                </TableRow>
              )}
              {requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-zinc-950 dark:text-white">
                      {r.tenant_name ?? r.tenant_id}
                    </div>
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
                  <TableCell className="text-zinc-500">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'open' ? (
                        <>
                          <Button
                            color="green"
                            disabled={busyId === r.id}
                            onClick={() => resolve(r.id, 'resolved')}
                          >
                            Resolve
                          </Button>
                          <Button
                            outline
                            disabled={busyId === r.id}
                            onClick={() => resolve(r.id, 'dismissed')}
                          >
                            Dismiss
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString() : ''}
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
    </PageShell>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { PlusIcon, StarIcon } from '@heroicons/react/20/solid'

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
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog'
import { PlanFormDialog } from '@/components/admin/plan-form-dialog'
import { priceLabel, validityLabel } from '@/components/admin/shared'
import { api, ApiError } from '@/lib/api'
import { useApiData, useApiToken } from '@/lib/hooks'
import type { AdminPlan, PlanWriteBody } from '@/lib/types'

const MIN_ACTIVE_PLANS = 3

export default function AdminPlansPage() {
  const getToken = useApiToken()
  const { data: plans, loading, error, refetch } = useApiData(
    (token) => api.admin.listPlans(token),
    [],
  )

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [deleting, setDeleting] = useState<AdminPlan | null>(null)

  const activeCount = (plans ?? []).filter((p) => p.is_active).length

  const handleCreate = useCallback(
    async (body: PlanWriteBody) => {
      const token = await getToken()
      try {
        await api.admin.createPlan(token, body)
        toast.success(`Plan "${body.name}" created.`)
        await refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to create plan.')
        throw err
      }
    },
    [getToken, refetch],
  )

  const handleUpdate = useCallback(
    async (planId: string, body: PlanWriteBody) => {
      const token = await getToken()
      try {
        await api.admin.updatePlan(token, planId, body)
        toast.success('Plan updated.')
        await refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to update plan.')
        throw err
      }
    },
    [getToken, refetch],
  )

  const handleDelete = useCallback(
    async (plan: AdminPlan) => {
      const token = await getToken()
      try {
        const result = await api.admin.deletePlan(token, plan.id)
        toast.success(result.detail)
        await refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to delete plan.')
      }
    },
    [getToken, refetch],
  )

  return (
    <PageShell>
      <PageHeader
        title="Plans"
        description="Manage the prepaid credit packs clients can be assigned. Each pack grants messages and call minutes usable within its validity window."
      >
        <Button color="brand" onClick={() => setShowCreate(true)}>
          <PlusIcon />
          New plan
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
                <TableHeader>Plan</TableHeader>
                <TableHeader className="text-right">Price</TableHeader>
                <TableHeader className="text-right">Messages</TableHeader>
                <TableHeader className="text-right">Call minutes</TableHeader>
                <TableHeader>Validity</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Clients</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-zinc-500">
                    Loading plans…
                  </TableCell>
                </TableRow>
              )}
              {!loading && (plans?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-zinc-500">
                    No plans yet. Create your first credit pack.
                  </TableCell>
                </TableRow>
              )}
              {plans?.map((p) => {
                const inUse = p.subscriber_count > 0
                const wouldDropBelowFloor = p.is_active && activeCount - 1 < MIN_ACTIVE_PLANS
                const deleteBlocked = inUse || wouldDropBelowFloor
                const deleteReason = inUse
                  ? `${p.subscriber_count} client(s) are on this plan`
                  : wouldDropBelowFloor
                    ? `At least ${MIN_ACTIVE_PLANS} active plans are required`
                    : undefined
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-950 dark:text-white">{p.name}</span>
                        {p.is_featured && (
                          <StarIcon className="size-4 text-amber-500" title="Featured" />
                        )}
                      </div>
                      <div className="font-mono text-xs text-zinc-400">{p.id}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {priceLabel(p.monthly_price_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.messages_quota.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.call_minutes_quota.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-zinc-500">{validityLabel(p.validity_days)}</TableCell>
                    <TableCell>
                      {p.is_active ? (
                        <Badge color="green">Active</Badge>
                      ) : (
                        <Badge color="zinc">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.subscriber_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button plain onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                        <span title={deleteReason}>
                          <Button
                            plain
                            disabled={deleteBlocked}
                            onClick={() => setDeleting(p)}
                            className="text-red-600 disabled:text-zinc-300 dark:disabled:text-zinc-600"
                          >
                            Delete
                          </Button>
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {loading && <SkeletonBlock className="h-2 w-0" />}

      {/* Create */}
      <PlanFormDialog open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />

      {/* Edit */}
      <PlanFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        plan={editing}
        onSubmit={(body) => handleUpdate(editing!.id, body)}
      />

      {/* Delete confirm */}
      <ConfirmActionDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'plan'}?`}
        description="This permanently removes the plan from the catalogue. Clients already on other plans are unaffected."
        confirmLabel="Yes, delete"
        busyLabel="Deleting…"
        color="red"
        onConfirm={async () => {
          if (deleting) await handleDelete(deleting)
        }}
      />
    </PageShell>
  )
}

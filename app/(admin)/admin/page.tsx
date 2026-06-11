'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Select } from '@/components/select'
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
import { useApiToken, usePlans } from '@/lib/hooks'
import type { AccountStatus, AdminTenant, Plan } from '@/lib/types'

const STATUS_COLOR: Record<AccountStatus, 'green' | 'amber' | 'red'> = {
  active: 'green',
  pending: 'amber',
  suspended: 'red',
}

const STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
}

export default function AdminTenantsPage() {
  const getToken = useApiToken()
  const { data: plans } = usePlans()
  const [tenants, setTenants] = useState<AdminTenant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const rows = await api.admin.listTenants(token)
      setTenants(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tenants.')
    }
  }, [getToken])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(
    async (id: string, fn: (token: string) => Promise<AdminTenant>, okMsg: string) => {
      if (busyId) return
      setBusyId(id)
      try {
        const token = await getToken()
        const updated = await fn(token)
        setTenants((prev) =>
          prev ? prev.map((t) => (t.id === id ? updated : t)) : prev,
        )
        toast.success(okMsg)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Action failed.')
      } finally {
        setBusyId(null)
      }
    },
    [busyId, getToken],
  )

  return (
    <PageShell>
      <PageHeader
        title="Tenants"
        description="Activate or suspend client accounts and assign plans. Suspended or pending tenants receive no inbound messages or calls."
      >
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
                <TableHeader>Status</TableHeader>
                <TableHeader>Plan</TableHeader>
                <TableHeader>Usage (msgs / mins)</TableHeader>
                <TableHeader>Bookings</TableHeader>
                <TableHeader>Convos</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants === null && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {tenants?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                    No tenants yet.
                  </TableCell>
                </TableRow>
              )}
              {tenants?.map((t) => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  plans={plans ?? []}
                  busy={busyId === t.id}
                  onActivate={() =>
                    runAction(t.id, (tok) => api.admin.activate(tok, t.id), `${t.name} activated.`)
                  }
                  onSuspend={() =>
                    runAction(t.id, (tok) => api.admin.suspend(tok, t.id), `${t.name} suspended.`)
                  }
                  onAssignPlan={(planId) =>
                    runAction(
                      t.id,
                      (tok) => api.admin.assignPlan(tok, t.id, planId),
                      `Plan updated for ${t.name}.`,
                    )
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageShell>
  )
}

function TenantRow({
  tenant,
  plans,
  busy,
  onActivate,
  onSuspend,
  onAssignPlan,
}: {
  tenant: AdminTenant
  plans: Plan[]
  busy: boolean
  onActivate: () => void
  onSuspend: () => void
  onAssignPlan: (planId: string) => void
}) {
  const usage = tenant.usage
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-zinc-950 dark:text-white">{tenant.name}</div>
        <div className="font-mono text-xs text-zinc-400">{tenant.id}</div>
      </TableCell>
      <TableCell>
        <Badge color={STATUS_COLOR[tenant.account_status]}>
          {STATUS_LABEL[tenant.account_status]}
        </Badge>
      </TableCell>
      <TableCell>{tenant.plan ? tenant.plan.name : <span className="text-zinc-400">—</span>}</TableCell>
      <TableCell className="tabular-nums">
        {usage.messages_used}/{usage.messages_quota} · {usage.call_minutes_used}/
        {usage.call_minutes_quota}
      </TableCell>
      <TableCell className="tabular-nums">{tenant.bookings_count}</TableCell>
      <TableCell className="tabular-nums">{tenant.conversations_count}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Select
            aria-label="Assign plan"
            className="w-36"
            value={tenant.plan?.id ?? ''}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value
              if (v) onAssignPlan(v)
            }}
          >
            <option value="">Assign plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {tenant.account_status === 'active' ? (
            <Button color="red" disabled={busy} onClick={onSuspend}>
              Suspend
            </Button>
          ) : (
            <Button color="green" disabled={busy} onClick={onActivate}>
              Activate
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PlusIcon, StarIcon } from '@heroicons/react/20/solid'

import { AgencyOnly } from '@/components/admin/agency-only'
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog'
import { PlanFormDialog } from '@/components/admin/plan-form-dialog'
import { StatusBadge, priceLabel, validityLabel } from '@/components/admin/shared'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { PlanPriceCalculator } from '@/components/admin/plan-price-calculator'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken, useIsAdmin } from '@/lib/hooks'
import type { AdminPlan, PlanWriteBody } from '@/lib/types'

export default function AgencyCreditsPage() {
  return (
    <AgencyOnly>
      <CreditsBody />
    </AgencyOnly>
  )
}

function CreditsBody() {
  const { isAgencyStaff } = useIsAdmin()
  const getToken = useApiToken()
  const plans = useApiData((token) => api.admin.listAgencyPlans(token), [])
  const clients = useApiData((token) => api.admin.listTenants(token), [])
  const [showCreate, setShowCreate] = useState(false)
  const [seed, setSeed] = useState<PlanWriteBody | null>(null)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [deleting, setDeleting] = useState<AdminPlan | null>(null)
  const assignable = (plans.data ?? []).filter((plan) => plan.is_active)

  const handleCreate = useCallback(
    async (body: PlanWriteBody) => {
      const token = await getToken()
      try {
        await api.admin.createAgencyPlan(token, body)
        toast.success(`Plan "${body.name}" created.`)
        await plans.refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to create plan.')
        throw err
      }
    },
    [getToken, plans],
  )

  const handleUpdate = useCallback(
    async (planId: string, body: PlanWriteBody) => {
      const token = await getToken()
      try {
        await api.admin.updateAgencyPlan(token, planId, body)
        toast.success('Plan updated.')
        await plans.refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to update plan.')
        throw err
      }
    },
    [getToken, plans],
  )

  const handleDelete = useCallback(
    async (plan: AdminPlan) => {
      const token = await getToken()
      try {
        const result = await api.admin.deleteAgencyPlan(token, plan.id)
        toast.success(result.detail)
        await plans.refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to delete plan.')
      }
    },
    [getToken, plans],
  )

  return (
    <PageShell>
      <PageHeader
        title="Plans & billing"
        description="Packs you sell to your clients. A pack is a price, call minutes, and messages. It is not the money those clients earn from jobs."
      >
        {isAgencyStaff ? null : (
          <Button
            color="brand"
            onClick={() => {
              setSeed(null)
              setShowCreate(true)
            }}
          >
            <PlusIcon />
            New plan
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Step n="1" title="Price a pack" detail="Set minutes, messages, and what the client pays." />
        <Step n="2" title="Save the pack" detail="It appears in the list below. You can edit it later." />
        <Step n="3" title="Give it to a client" detail="Assign the pack, or add extra minutes and messages." />
      </div>

      {isAgencyStaff ? null : (
        <PlanPriceCalculator
          audience="agency"
          onUse={(body) => {
            setSeed(body)
            setShowCreate(true)
          }}
        />
      )}

      {plans.error ? <p className="text-sm text-red-600">{plans.error}</p> : null}
      <div className={dashCardClass}>
        <div className="px-5 pt-5">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Packs you sell</h2>
          <p className="mt-1 text-sm text-zinc-500">The price is what the client pays you for those minutes and messages.</p>
        </div>
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
              {plans.loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-zinc-500">
                    Loading plans…
                  </TableCell>
                </TableRow>
              ) : null}
              {!plans.loading && (plans.data?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-zinc-500">
                    No plans yet. Create your first credit pack.
                  </TableCell>
                </TableRow>
              ) : null}
              {(plans.data ?? []).map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-950 dark:text-white">{plan.name}</span>
                      {plan.is_featured ? <StarIcon className="size-4 text-amber-500" title="Featured" /> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{priceLabel(plan.monthly_price_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {plan.messages_unlimited ? 'Unlimited' : plan.messages_quota.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{plan.call_minutes_quota.toLocaleString()}</TableCell>
                  <TableCell className="text-zinc-500">{validityLabel(plan.validity_days)}</TableCell>
                  <TableCell>
                    {plan.is_active ? <Badge color="green">Active</Badge> : <Badge color="zinc">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{plan.subscriber_count}</TableCell>
                  <TableCell>
                    {isAgencyStaff ? null : (
                      <div className="flex items-center justify-end gap-2">
                        <Button plain onClick={() => setEditing(plan)}>
                          Edit
                        </Button>
                        <Button
                          plain
                          disabled={plan.subscriber_count > 0}
                          title={plan.subscriber_count > 0 ? `${plan.subscriber_count} client(s) are on this plan` : undefined}
                          onClick={() => setDeleting(plan)}
                          className="text-red-600 disabled:text-zinc-300 dark:disabled:text-zinc-600"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {clients.loading ? <SkeletonBlock className="h-40" /> : null}
      {clients.error ? <p className="text-sm text-red-600">{clients.error}</p> : null}
      {!clients.loading && (clients.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-zinc-500">No clients yet.</p>
      ) : null}
      <div>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Your clients</h2>
        <p className="mt-1 text-sm text-zinc-500">Give a saved pack to a client, or add extra minutes and messages to the pack they already have.</p>
      </div>
      <div className="space-y-3">
        {(clients.data ?? []).map((client) => (
          <article key={client.id} className={`${dashCardClass} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/admin/clients/${encodeURIComponent(client.id)}`}
                  className="font-medium text-zinc-950 hover:text-brand-700 dark:text-white"
                >
                  {client.name}
                </Link>
                <p className="mt-1 text-sm text-zinc-500">
                  {client.plan?.name ?? 'No pack'}
                  {client.subscription_expires_at ? ` · until ${client.subscription_expires_at.slice(0, 10)}` : ''}
                </p>
              </div>
              <StatusBadge status={client.account_status} />
            </div>
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
              Call minutes used {client.usage.call_minutes_used} / {client.usage.call_minutes_quota || '—'}
              {' · '}
              Messages used {client.usage.messages_used}
              {client.plan?.messages_unlimited ? ' · unlimited' : ` / ${client.usage.messages_quota || '—'}`}
            </p>
            {isAgencyStaff ? null : (
              <PackActions
                tenantId={client.id}
                plans={assignable}
                onSaved={() => void clients.refetch()}
              />
            )}
          </article>
        ))}
      </div>

      <PlanFormDialog
        open={showCreate}
        seed={seed}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
      <PlanFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        plan={editing}
        onSubmit={(body) => handleUpdate(editing!.id, body)}
      />
      <ConfirmActionDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'plan'}?`}
        description="This permanently removes the plan. Clients already on other plans are unaffected."
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

function Step({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <div className={`${dashCardClass} p-4`}>
      <p className="text-xs font-semibold text-blue-600">Step {n}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{detail}</p>
    </div>
  )
}

function PackActions({
  tenantId,
  plans,
  onSaved,
}: {
  tenantId: string
  plans: { id: string; name: string }[]
  onSaved: () => void
}) {
  const getToken = useApiToken()
  const [planId, setPlanId] = useState('')
  const [minutes, setMinutes] = useState('')
  const [messages, setMessages] = useState('')
  const [busy, setBusy] = useState(false)

  async function assign() {
    if (!planId) return
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.assignPlan(token, tenantId, planId)
      toast.success('Credit pack assigned')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not assign the pack.')
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    const call_minutes_delta = Number(minutes || 0)
    const messages_delta = Number(messages || 0)
    if (!call_minutes_delta && !messages_delta) {
      toast.error('Enter minutes or messages to add.')
      return
    }
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.addCredits(token, tenantId, {
        call_minutes_delta,
        messages_delta,
        reason: 'Agency top-up',
      })
      toast.success('Credits added')
      setMinutes('')
      setMessages('')
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add credits.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-zinc-500">Give this client a pack, or add extra minutes and messages.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Select aria-label="Pack" className="min-w-40" value={planId} onChange={(event) => setPlanId(event.target.value)}>
          <option value="">Choose a pack</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </Select>
        <Button outline disabled={busy || !planId} onClick={() => void assign()}>
          Give this pack
        </Button>
        <Input className="max-w-32" inputMode="numeric" placeholder="Extra minutes" aria-label="Extra minutes" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        <Input className="max-w-32" inputMode="numeric" placeholder="Extra messages" aria-label="Extra messages" value={messages} onChange={(event) => setMessages(event.target.value)} />
        <Button outline disabled={busy} onClick={() => void add()}>
          Add to this client
        </Button>
      </div>
    </div>
  )
}

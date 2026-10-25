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
        title="Plans & credits"
        description="Create prepaid packs for your clients. You only see the plans you create."
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

      {isAgencyStaff ? null : (
        <PlanCalculator
          onUse={(body) => {
            setSeed(body)
            setShowCreate(true)
          }}
        />
      )}

      {plans.error ? <p className="text-sm text-red-600">{plans.error}</p> : null}
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
              Minutes {client.usage.call_minutes_used} / {client.usage.call_minutes_quota || '—'}
              {' · '}
              Messages {client.usage.messages_used}
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

function PlanCalculator({ onUse }: { onUse: (body: PlanWriteBody) => void }) {
  const [minutes, setMinutes] = useState('300')
  const [messages, setMessages] = useState('3000')
  const [minuteCost, setMinuteCost] = useState('0.10')
  const [messageCost, setMessageCost] = useState('0')
  const [markup, setMarkup] = useState('100')
  const mins = Math.max(0, Number(minutes) || 0)
  const msgs = Math.max(0, Number(messages) || 0)
  const perMinute = Math.max(0, Number(minuteCost) || 0)
  const perMessage = Math.max(0, Number(messageCost) || 0)
  const mark = Math.max(0, Number(markup) || 0)
  const cost = mins * perMinute + msgs * perMessage
  const price = cost * (1 + mark / 100)
  const profit = price - cost
  const eachMinute = mins > 0 ? price / mins : 0

  return (
    <section className={`${dashCardClass} space-y-4 p-5`}>
      <div>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Price calculator</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Type what a minute and a message cost you. The suggested price adds your markup. You can still change the price before saving.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="text-zinc-500">Call minutes</span>
          <Input className="mt-1" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Messages</span>
          <Input className="mt-1" inputMode="numeric" value={messages} onChange={(event) => setMessages(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Your cost per minute</span>
          <Input className="mt-1" inputMode="decimal" value={minuteCost} onChange={(event) => setMinuteCost(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Your cost per message</span>
          <Input className="mt-1" inputMode="decimal" value={messageCost} onChange={(event) => setMessageCost(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Markup %</span>
          <Input className="mt-1" inputMode="decimal" value={markup} onChange={(event) => setMarkup(event.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Result label="Your cost" value={money(cost)} />
        <Result label="Suggested price" value={money(price)} />
        <Result label="Profit" value={money(profit)} />
        <Result label="Price per included minute" value={mins > 0 ? money(eachMinute) : '—'} />
      </div>
      <Button
        outline
        onClick={() =>
          onUse({
            name: '',
            monthly_price_cents: Math.round(price * 100),
            currency: 'USD',
            messages_quota: Math.round(msgs),
            call_minutes_quota: Math.round(mins),
            validity_days: 180,
            features: [],
            best_for: '',
            approx_calls: '',
            spam_calls_label: 'Free, no minutes',
            extra_minute_cents: Math.round(perMinute * (1 + mark / 100) * 100),
            messages_unlimited: false,
            is_featured: false,
            sort_order: 0,
            is_active: true,
          })
        }
      >
        Use this price
      </Button>
    </section>
  )
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
    </div>
  )
}

function money(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <Select aria-label="Credit pack" value={planId} onChange={(event) => setPlanId(event.target.value)}>
        <option value="">Choose a pack</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </Select>
      <Button outline disabled={busy || !planId} onClick={() => void assign()}>
        Assign pack
      </Button>
      <Input className="max-w-28" inputMode="numeric" placeholder="Minutes" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
      <Input className="max-w-28" inputMode="numeric" placeholder="Messages" value={messages} onChange={(event) => setMessages(event.target.value)} />
      <Button outline disabled={busy} onClick={() => void add()}>
        Add credits
      </Button>
    </div>
  )
}

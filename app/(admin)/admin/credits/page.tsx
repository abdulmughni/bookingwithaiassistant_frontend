'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

import { AgencyOnly } from '@/components/admin/agency-only'
import { StatusBadge, priceLabel, validityLabel } from '@/components/admin/shared'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken, useIsAdmin, usePlans } from '@/lib/hooks'

export default function AgencyCreditsPage() {
  return (
    <AgencyOnly>
      <CreditsBody />
    </AgencyOnly>
  )
}

function CreditsBody() {
  const { isAgencyStaff } = useIsAdmin()
  const plans = usePlans()
  const clients = useApiData((token) => api.admin.listTenants(token), [])

  return (
    <PageShell>
      <PageHeader
        title="Plans & credits"
        description="Credit packs are prepaid. This is not a monthly subscription, and the catalogue is set by the platform."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.loading ? <SkeletonBlock className="h-32" /> : null}
        {plans.error ? <p className="text-sm text-red-600">{plans.error}</p> : null}
        {(plans.data ?? []).map((plan) => (
          <article key={plan.id} className={`${dashCardClass} p-5`}>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">{plan.name}</h2>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{priceLabel(plan.monthly_price_cents)}</p>
            <p className="mt-2 text-sm text-zinc-500">
              {plan.messages_unlimited ? 'Unlimited messages' : `${plan.messages_quota.toLocaleString()} messages`}
              {' · '}
              {plan.call_minutes_quota.toLocaleString()} minutes · {validityLabel(plan.validity_days)}
            </p>
          </article>
        ))}
      </section>

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
                plans={plans.data ?? []}
                onSaved={() => void clients.refetch()}
              />
            )}
          </article>
        ))}
      </div>
    </PageShell>
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

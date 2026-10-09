'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { CheckIcon, StarIcon } from '@heroicons/react/20/solid'

import { Button } from '@/components/button'
import { Textarea } from '@/components/textarea'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { PageHeader, PageShell } from '@/components/dashboard-ui'
import { useApiToken, usePlans, useSubscription } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import type { Plan } from '@/lib/types'

/**
 * Standalone Plans page.
 *
 * Cards are rendered from the plans catalogue. "Book a free demo" opens the
 * existing plan-change request so an admin can review and apply it.
 */
export default function PlansPage() {
  const { data: plans, loading: plansLoading, error: plansError } = useSubscriptionPlans()
  const { data: subscription, loading: subLoading } = useSubscription()
  const getToken = useApiToken()

  const [requestPlan, setRequestPlan] = useState<Plan | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentPlanId = subscription?.plan?.id ?? null

  const openRequest = (plan: Plan) => {
    if (plan.id === currentPlanId) return
    setMessage('')
    setRequestPlan(plan)
  }

  const submitRequest = async () => {
    if (!requestPlan || submitting) return
    setSubmitting(true)
    try {
      const token = await getToken()
      await api.plans.requestChange(token, {
        requested_plan_id: requestPlan.id,
        message,
      })
      toast.success('Plan change requested. An admin will review it shortly.')
      setRequestPlan(null)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not submit request.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell className="mx-auto max-w-6xl">
      <PageHeader
        centered
        title="Plans & pricing"
        description="Same complete system on every plan. Just pick the size that fits your shop."
      />

      {plansError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {plansError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-3 md:items-stretch">
        {plansLoading && !plans && (
          <>
            <PlanCardSkeleton />
            <PlanCardSkeleton featured />
            <PlanCardSkeleton />
          </>
        )}

        {plans?.map((plan, index) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            accent={CARD_ACCENTS[index % CARD_ACCENTS.length]}
            current={plan.id === currentPlanId}
            onSelect={() => openRequest(plan)}
            subscriptionLoading={subLoading}
          />
        ))}
      </div>

      <Dialog open={requestPlan !== null} onClose={() => (submitting ? null : setRequestPlan(null))}>
        <DialogTitle>Request plan change</DialogTitle>
        <DialogDescription>
          {requestPlan
            ? `Ask an administrator to switch your workspace to the ${requestPlan.name} plan. Add an optional note below.`
            : ''}
        </DialogDescription>
        <DialogBody>
          <Textarea
            rows={4}
            placeholder="Optional message for the admin (e.g. when you'd like this to take effect)…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
          />
        </DialogBody>
        <DialogActions>
          <Button plain disabled={submitting} onClick={() => setRequestPlan(null)}>
            Cancel
          </Button>
          <Button color="brand" disabled={submitting} onClick={submitRequest}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  )
}

/** Thin alias so the page keeps reading clearly; plans come from the catalogue. */
function useSubscriptionPlans() {
  return usePlans()
}

// ---------------------------------------------------------------------------
// Single plan card
// ---------------------------------------------------------------------------

const CARD_ACCENTS = [
  {
    name: 'text-blue-600 dark:text-blue-400',
    price: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/70',
    wash: 'bg-gradient-to-b from-blue-50/90 to-white dark:from-blue-950/30 dark:to-zinc-900',
    check: 'text-blue-500',
  },
  {
    name: 'text-violet-600 dark:text-violet-300',
    price: 'text-violet-600 dark:text-violet-300',
    border: 'border-violet-300 dark:border-violet-700/80',
    wash: 'bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/40 dark:to-zinc-900',
    check: 'text-violet-500',
  },
  {
    name: 'text-fuchsia-600 dark:text-fuchsia-400',
    price: 'text-fuchsia-600 dark:text-fuchsia-400',
    border: 'border-fuchsia-200 dark:border-fuchsia-800/70',
    wash: 'bg-gradient-to-b from-fuchsia-50/90 to-white dark:from-fuchsia-950/30 dark:to-zinc-900',
    check: 'text-fuchsia-500',
  },
]

function PlanCard({
  plan,
  accent,
  current,
  onSelect,
  subscriptionLoading,
}: {
  plan: Plan
  accent: (typeof CARD_ACCENTS)[number]
  current: boolean
  onSelect: () => void
  subscriptionLoading: boolean
}) {
  const featured = plan.is_featured
  const messagesLabel = plan.messages_unlimited
    ? 'Unlimited'
    : `${plan.messages_quota.toLocaleString()}/mo`

  return (
    <div
      className={clsx(
        'relative flex flex-col rounded-3xl border p-6 shadow-sm',
        accent.border,
        accent.wash,
        featured && 'ring-2 ring-violet-400/70 dark:ring-violet-500/50',
      )}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
          <StarIcon className="size-3.5" />
          Most popular
        </div>
      )}

      <div className={clsx('text-center', featured && 'pt-2')}>
        <div className="flex items-center justify-center gap-2">
          <h3 className={clsx('text-sm font-bold uppercase tracking-[0.16em]', accent.name)}>
            {plan.name}
          </h3>
          {current && (
            <span className="rounded-full bg-zinc-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
              Current
            </span>
          )}
        </div>
        <div className="mt-3">
          <span className={clsx('text-5xl font-bold tracking-tight', accent.price)}>
            {formatPrice(plan.monthly_price_cents, plan.currency)}
          </span>
          <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">/mo</span>
        </div>
        {plan.best_for ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{plan.best_for}</p>
        ) : null}
      </div>

      <div className="mt-5">
        <SpecRow label="Voice minutes" value={`${plan.call_minutes_quota.toLocaleString()}/mo`} />
        <SpecRow label="Approx. calls" value={plan.approx_calls || '—'} />
        <SpecRow label="Facebook & Instagram" value={messagesLabel} />
        <SpecRow label="Spam calls" value={plan.spam_calls_label || 'Free, no minutes'} />
        <SpecRow label="Extra minutes" value={formatExtraMinute(plan.extra_minute_cents)} />
      </div>

      {plan.features.length > 0 && (
        <>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Every plan includes:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <CheckIcon className={clsx('mt-0.5 size-4 shrink-0', accent.check)} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex-1" />

      {current ? (
        <Button outline disabled className="w-full uppercase tracking-wide">
          Current plan
        </Button>
      ) : (
        <Button
          color="blue"
          disabled={subscriptionLoading}
          onClick={onSelect}
          className="w-full uppercase tracking-wide"
        >
          {subscriptionLoading ? 'Loading…' : 'Book a free demo'}
        </Button>
      )}
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200/80 py-2.5 text-sm last:border-b-0 dark:border-zinc-700/70">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right font-semibold text-zinc-900 dark:text-white">{value}</span>
    </div>
  )
}

function PlanCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={clsx(
        'h-105 animate-pulse rounded-2xl border bg-white p-6 dark:bg-zinc-900',
        featured
          ? 'border-brand-200 dark:border-brand-800/60'
          : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-9 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-3 w-4/6 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 h-9 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExtraMinute(cents: number | null | undefined): string {
  const amount = (cents ?? 66) / 100
  const digits = Number.isInteger(amount) ? 0 : 2
  return `$${amount.toFixed(digits)}/min`
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `$${amount.toFixed(0)}`
  }
}

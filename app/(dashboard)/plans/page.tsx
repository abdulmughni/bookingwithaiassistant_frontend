'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { CheckIcon, StarIcon } from '@heroicons/react/20/solid'

import { Button } from '@/components/button'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
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
 * Standalone Plans page (read-only).
 *
 * Lists the three tiers seeded by ``20260512_plans_subscriptions.sql``. Clients
 * can no longer self-switch plans (no payment integration yet): clicking
 * "Request this plan" opens a modal that submits a plan-change request for an
 * admin to review and apply from the admin dashboard.
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
        description="Pick a tier that fits how many customer messages and voice minutes your team runs each month. Submit a request and an administrator will apply your plan change."
      />

      {plansError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {plansError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
        {plansLoading && !plans && (
          <>
            <PlanCardSkeleton />
            <PlanCardSkeleton featured />
            <PlanCardSkeleton />
          </>
        )}

        {plans?.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            current={plan.id === currentPlanId}
            onSelect={() => openRequest(plan)}
            subscriptionLoading={subLoading}
          />
        ))}
      </div>

      <Text className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
        All plans are billed in USD per 30-day window. Plan changes are applied
        by an administrator after your request is reviewed.
      </Text>

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

function PlanCard({
  plan,
  current,
  onSelect,
  subscriptionLoading,
}: {
  plan: Plan
  current: boolean
  onSelect: () => void
  subscriptionLoading: boolean
}) {
  const featured = plan.is_featured

  return (
    <div
      className={clsx(
        'relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition dark:bg-zinc-900',
        featured
          ? 'border-brand-400 ring-1 ring-brand-200/80 md:scale-[1.03] dark:border-brand-600 dark:ring-brand-900/60'
          : 'border-zinc-200/80 dark:border-zinc-700/80',
      )}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow">
          <StarIcon className="size-3.5" />
          Most popular
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <Subheading className="mt-0!">{plan.name}</Subheading>
        {current && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Current
          </span>
        )}
      </div>

      <div className="mt-3">
        <span className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
          {formatPrice(plan.monthly_price_cents, plan.currency)}
        </span>
        <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">
          /mo
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold tabular-nums">
            {plan.messages_quota.toLocaleString()}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            outbound messages / month
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold tabular-nums">
            {plan.call_minutes_quota.toLocaleString()}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            voice minutes / month
          </span>
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {plan.best_for && (
        <p className="mt-4 text-xs italic text-zinc-500 dark:text-zinc-400">
          Best for: {plan.best_for}
        </p>
      )}

      <div className="mt-6 flex-1" />

      {current ? (
        <Button outline disabled className="w-full">
          Current plan
        </Button>
      ) : (
        <Button
          color={featured ? 'brand' : 'dark/zinc'}
          disabled={subscriptionLoading}
          onClick={onSelect}
          className="w-full"
        >
          {subscriptionLoading ? 'Loading…' : 'Request this plan'}
        </Button>
      )}
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

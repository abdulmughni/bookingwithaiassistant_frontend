'use client'

import Link from 'next/link'
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'

import { useApiData, useSubscription } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { ChannelAccount } from '@/lib/types'

/** Client-facing ops banners only: Meta reconnect + usage ≥80%. No admin health radar. */
export function ClientOpsBanners() {
  const { data: channels } = useApiData<ChannelAccount[]>((token) => api.channels.list(token), [])
  const { data: subscription } = useSubscription()

  const brokenMeta = (channels ?? []).filter(
    (ch) =>
      (ch.channel === 'facebook' || ch.channel === 'instagram') &&
      ch.is_active &&
      String(ch.connection_status || '').toLowerCase() === 'error',
  )

  const usage = subscription?.usage
  const usageWarn =
    usage != null &&
    (usage.quota_state === 'warning' ||
      usage.quota_state === 'over' ||
      usage.messages_pct >= 80 ||
      usage.call_minutes_pct >= 80)

  if (brokenMeta.length === 0 && !usageWarn) return null

  return (
    <div className="mb-6 space-y-3">
      {brokenMeta.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50"
        >
          <div className="flex flex-wrap items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Your Facebook connection needs a quick re-link — takes 60 seconds
              </p>
              <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
                {brokenMeta.some((c) => c.channel === 'instagram')
                  ? 'Facebook Page and/or Instagram messaging is disconnected.'
                  : 'Facebook Page messaging is disconnected.'}{' '}
                Incoming chats may fail until you reconnect.
              </p>
              <Link
                href="/accounts"
                className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                Reconnect
              </Link>
            </div>
          </div>
        </div>
      )}

      {usageWarn && usage && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50"
        >
          <div className="flex flex-wrap items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">You&apos;re using most of your pack</p>
              <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
                Messages at {Math.round(usage.messages_pct)}% · Call minutes at{' '}
                {Math.round(usage.call_minutes_pct)}%. Open Plans to review or request more
                credits.
              </p>
              <Link
                href="/plans"
                className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

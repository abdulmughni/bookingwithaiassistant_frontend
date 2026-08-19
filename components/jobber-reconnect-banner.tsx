'use client'

import Link from 'next/link'
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { useApiData } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { Tenant } from '@/lib/types'

export function JobberReconnectBanner() {
  const { data: tenant } = useApiData<Tenant>((token) => api.tenants.me(token))

  const needsReconnect =
    tenant?.crm_type === 'jobber' &&
    Boolean(tenant?.crm_settings?.jobber_needs_reconnect)

  if (!needsReconnect) {
    return null
  }

  const detail = tenant?.crm_settings?.jobber_last_error?.trim()

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <div className="flex flex-wrap items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Jobber needs to be reconnected</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Your live Jobber calendar is disconnected. Customers may not see accurate
            availability until you connect again.
          </p>
          {detail ? (
            <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/70">{detail}</p>
          ) : null}
          <Link
            href="/integrations"
            className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
          >
            Reconnect Jobber
          </Link>
        </div>
      </div>
    </div>
  )
}

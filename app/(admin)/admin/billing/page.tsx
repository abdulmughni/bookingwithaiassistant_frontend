'use client'

import Link from 'next/link'

import { AgencyOnly } from '@/components/admin/agency-only'
import { priceLabel } from '@/components/admin/shared'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'

export default function AgencyBillingPage() {
  return (
    <AgencyOnly>
      <BillingBody />
    </AgencyOnly>
  )
}

function BillingBody() {
  const clients = useApiData((token) => api.admin.listTenants(token), [])
  const setups = useApiData((token) => api.admin.listSetupRequests(token), [])
  const packs = (clients.data ?? []).filter((client) => client.plan)
  const packTotal = packs.reduce((sum, client) => sum + (client.plan?.monthly_price_cents ?? 0), 0)
  const fees = (setups.data ?? []).filter((row) => row.setup_fee_cents != null)
  const feeTotal = fees.reduce((sum, row) => sum + (row.setup_fee_cents ?? 0), 0)

  return (
    <PageShell>
      <PageHeader
        title="Billing"
        description="Pack value assigned to your clients, plus setup fees the platform has recorded. This is not money collected and not your revenue."
      />
      {clients.loading ? <SkeletonBlock className="h-40" /> : null}
      {clients.error ? <p className="text-sm text-red-600">{clients.error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${dashCardClass} p-5`}>
          <p className="text-sm text-zinc-500">Pack value assigned</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">{priceLabel(packTotal)}</p>
        </div>
        <div className={`${dashCardClass} p-5`}>
          <p className="text-sm text-zinc-500">Setup fees recorded</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">{priceLabel(feeTotal)}</p>
        </div>
      </div>

      <section className={`${dashCardClass} overflow-x-auto p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Credit packs</h2>
        {packs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No credit packs are assigned yet.</p>
        ) : (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Pack</th>
                <th className="py-2 pr-3 font-medium">Price</th>
                <th className="py-2 pr-3 font-medium">Started</th>
                <th className="py-2 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((client) => (
                <tr key={client.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 pr-3">
                    <Link href={`/admin/clients/${encodeURIComponent(client.id)}`} className="font-medium text-zinc-950 dark:text-white">
                      {client.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">{client.plan?.name}</td>
                  <td className="py-3 pr-3">{priceLabel(client.plan?.monthly_price_cents ?? 0)}</td>
                  <td className="py-3 pr-3">{client.subscription_started_at?.slice(0, 10) ?? '—'}</td>
                  <td className="py-3">{client.subscription_expires_at?.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Setup fees</h2>
        {setups.loading ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : null}
        {setups.error ? <p className="mt-3 text-sm text-red-600">{setups.error}</p> : null}
        {!setups.loading && fees.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No setup fee has been recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {fees.map((row) => (
              <li key={row.tenant_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <Link href={`/admin/clients/${encodeURIComponent(row.tenant_id)}`} className="font-medium text-zinc-950 dark:text-white">
                  {row.tenant_name || row.tenant_id}
                </Link>
                <span>{priceLabel(row.setup_fee_cents ?? 0)} recorded</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}

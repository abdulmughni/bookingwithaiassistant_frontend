'use client'

import { AgencyBrandForm } from '@/components/admin/agency-brand-form'
import { PageHeader, PageShell, dashCardClass } from '@/components/dashboard-ui'
import { useIsAdmin } from '@/lib/hooks'

export default function AgencyBrandPage() {
  const { isAgency, tenantId, loading } = useIsAdmin()

  return (
    <PageShell>
      <PageHeader
        title="Brand"
        description="Your logo and colors appear on your screens and on your clients' dashboards."
      />
      <section className={`${dashCardClass} p-5 sm:p-6`}>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : isAgency && tenantId ? (
          <AgencyBrandForm agencyId={tenantId} />
        ) : (
          <p className="text-sm text-zinc-500">Brand settings are for an agency login.</p>
        )}
      </section>
    </PageShell>
  )
}

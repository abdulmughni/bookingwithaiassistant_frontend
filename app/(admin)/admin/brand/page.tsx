'use client'

import { AgencyBrandForm } from '@/components/admin/agency-brand-form'
import { PageHeader, PageShell, dashCardClass } from '@/components/dashboard-ui'
import { useIsAdmin } from '@/lib/hooks'

export default function AgencyBrandPage() {
  const { isAgency, isAgencyStaff, tenantId, loading } = useIsAdmin()

  return (
    <PageShell>
      <PageHeader
        title="Branding"
        description="Your logo and colors appear on your screens and on your clients' dashboards."
      />
      <section className={`${dashCardClass} p-5 sm:p-6`}>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : isAgency && isAgencyStaff ? (
          <p className="text-sm text-zinc-500">Only the agency owner can change the logo and colors.</p>
        ) : isAgency && tenantId ? (
          <AgencyBrandForm agencyId={tenantId} />
        ) : (
          <p className="text-sm text-zinc-500">Brand settings are for an agency login.</p>
        )}
      </section>
    </PageShell>
  )
}

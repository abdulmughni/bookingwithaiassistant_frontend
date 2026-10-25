'use client'

import { useMemo, useState } from 'react'

import { AgencyOnly } from '@/components/admin/agency-only'
import { RangeToggle } from '@/components/admin/agency-home'
import {
  AgencyRangeChart,
  ClientPerformanceTable,
  DashboardCard,
} from '@/components/admin/agency-dashboard'
import { PageHeader, PageShell, SkeletonBlock } from '@/components/dashboard-ui'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'

export default function AgencyActivityPage() {
  return (
    <AgencyOnly>
      <ActivityBody />
    </AgencyOnly>
  )
}

function ActivityBody() {
  const [days, setDays] = useState<7 | 30>(30)
  const clientsQuery = useApiData((token) => api.admin.listTenants(token), [])
  const activityQuery = useApiData((token) => api.admin.agencyActivity(token, days), [days])
  const counts = useMemo(() => {
    const map = new Map<string, { bookings: number; calls: number; messages: number }>()
    for (const row of activityQuery.data?.clients ?? []) map.set(row.tenant_id, row)
    return map
  }, [activityQuery.data])

  return (
    <PageShell>
      <PageHeader
        title="Client activity"
        description="Bookings, calls, and messages across your clients."
      />
      <DashboardCard title="Bookings">
        <RangeToggle days={days} onChange={setDays} />
        {activityQuery.loading ? (
          <SkeletonBlock className="mt-4 h-64" />
        ) : activityQuery.error ? (
          <p className="mt-3 text-sm text-red-600">{activityQuery.error}</p>
        ) : (activityQuery.data?.series.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No bookings in this range.</p>
        ) : (
          <div className="mt-4">
            <AgencyRangeChart series={activityQuery.data?.series ?? []} />
          </div>
        )}
      </DashboardCard>
      <DashboardCard title="By client">
        {clientsQuery.loading ? (
          <SkeletonBlock className="h-40" />
        ) : clientsQuery.error ? (
          <p className="text-sm text-red-600">{clientsQuery.error}</p>
        ) : (
          <ClientPerformanceTable clients={clientsQuery.data ?? []} counts={counts} />
        )}
      </DashboardCard>
    </PageShell>
  )
}

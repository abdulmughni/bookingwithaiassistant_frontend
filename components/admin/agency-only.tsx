'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { PageShell, SkeletonBlock } from '@/components/dashboard-ui'
import { useIsAdmin } from '@/lib/hooks'

export function AgencyOnly({ children }: { children: ReactNode }) {
  const { isAgency, loading } = useIsAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAgency) router.replace('/admin')
  }, [isAgency, loading, router])

  if (loading || !isAgency) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }
  return <>{children}</>
}

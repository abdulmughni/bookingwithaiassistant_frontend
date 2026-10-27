'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AgencyBrandPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/settings?tab=brand')
  }, [router])
  return null
}

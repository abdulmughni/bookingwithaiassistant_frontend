'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Voice setup moved to admin client detail. Clients are redirected home. */
export default function VoicePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )
}

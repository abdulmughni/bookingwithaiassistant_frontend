'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/** Deep links to /clients/:id redirect to the list page with the modal open. */
export default function ClientDetailRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const id = decodeURIComponent(String(params.id ?? ''))

  useEffect(() => {
    if (id) {
      router.replace(`/clients?client=${encodeURIComponent(id)}`)
    } else {
      router.replace('/clients')
    }
  }, [id, router])

  return null
}

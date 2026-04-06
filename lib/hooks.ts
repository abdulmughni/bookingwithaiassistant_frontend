'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api'

export function useApiToken() {
  const { getToken, orgId } = useAuth()

  const fetchToken = useCallback(async () => {
    // Session tokens often omit org claims unless you pass organizationId.
    // Backend tenant_id / RLS requires org_id in the JWT.
    if (orgId) {
      const token = await getToken({ organizationId: orgId })
      return token ?? ''
    }
    return (await getToken()) ?? ''
  }, [getToken, orgId])

  return fetchToken
}

/**
 * Use when starting OAuth (Facebook / Instagram / WhatsApp / Google Calendar). Clerk can return a
 * cached session JWT from a previous active org; skipCache forces a token that
 * matches the current organizationId so the backend state JWT tenant_id aligns
 * with the workspace the user sees after redirect.
 */
export function useFreshOrgToken() {
  const { getToken, orgId } = useAuth()

  return useCallback(async () => {
    if (!orgId) {
      return ''
    }
    return (await getToken({ organizationId: orgId, skipCache: true })) ?? ''
  }, [getToken, orgId])
}

export function useApiData<T>(
  fetcher: (token: string) => Promise<T>,
  deps: unknown[] = [],
) {
  const getToken = useApiToken()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const result = await fetcherRef.current(token)
      setData(result)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      setLoading(false)
    }
  }, [getToken, ...deps])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

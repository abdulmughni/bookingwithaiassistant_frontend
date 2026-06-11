'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '@/lib/api'

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

/**
 * IANA timezone of the current tenant. Falls back to the browser's tz while
 * the tenant record is loading so dashboards never render bogus times.
 *
 * Cached on `window` for the session: every dashboard page hits this and we
 * don't want N parallel ``/tenants/me`` calls. ``useApiData`` already handles
 * Suspense-style transitions; this hook stays cheap on re-renders.
 */
const TENANT_TZ_GLOBAL_KEY = '__bookingwithai_tenant_tz__'

export function useTenantTimezone(): string {
  const getToken = useApiToken()
  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )

  type CacheCarrier = { [TENANT_TZ_GLOBAL_KEY]?: string }
  const cached =
    typeof window !== 'undefined'
      ? (window as unknown as CacheCarrier)[TENANT_TZ_GLOBAL_KEY]
      : undefined
  const [tz, setTz] = useState<string>(cached || browserTz)

  useEffect(() => {
    if (cached) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const tenant = await api.tenants.me(token)
        if (cancelled) return
        const value =
          (typeof tenant.timezone === 'string' && tenant.timezone.trim()) ||
          browserTz
        if (typeof window !== 'undefined') {
          ;(window as unknown as CacheCarrier)[TENANT_TZ_GLOBAL_KEY] = value
        }
        setTz(value)
      } catch {
        // Network/auth errors are non-fatal: callers fall back to browser tz.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken, browserTz, cached])

  return tz
}

// ---------------------------------------------------------------------------
// Subscription (plan + usage) — sidebar widget + /plans page share this.
// ---------------------------------------------------------------------------

/**
 * Current tenant's plan + 30-day usage window. Polled every 60s so the
 * sidebar "X messages left" stays roughly live without a websocket.
 *
 * Returns ``data: null`` on first paint while the API is in-flight; the
 * widget renders a tiny skeleton in that case. ``refetch`` is exposed so
 * the /plans page can immediately update the sidebar after a switch.
 */
export function useSubscription({ pollMs = 60000 }: { pollMs?: number } = {}) {
  const getToken = useApiToken()
  const [data, setData] = useState<import('./types').Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const token = await getToken()
      const sub = await api.plans.mySubscription(token)
      setData(sub)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError(err instanceof Error ? err.message : 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    let cancelled = false
    void refetch()
    if (pollMs <= 0) return
    const t = setInterval(() => {
      if (!cancelled) void refetch()
    }, pollMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [refetch, pollMs])

  return { data, loading, error, refetch }
}

/**
 * Current tenant's admin-managed lifecycle status ('pending' | 'active' |
 * 'suspended'). Drives the dashboard suspended/pending gate. Returns
 * ``status: null`` while loading or on error so callers fail open (render the
 * dashboard) rather than hard-blocking on a transient hiccup.
 */
export function useAccountStatus() {
  const getToken = useApiToken()
  const [status, setStatus] = useState<import('./types').AccountStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const token = await getToken()
      const tenant = await api.tenants.me(token)
      setStatus((tenant.account_status as import('./types').AccountStatus) ?? 'active')
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { status, loading, refetch }
}

/**
 * Whether the current Clerk user is a platform admin (server-checked against
 * the ``ADMIN_USER_IDS`` allowlist). Drives the conditional "Admin" nav entry
 * and the admin route gate. Fails closed: any error → not admin.
 */
export function useIsAdmin() {
  const getToken = useApiToken()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const me = await api.admin.me(token)
        if (!cancelled) setIsAdmin(Boolean(me?.is_admin))
      } catch {
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  return { isAdmin, loading }
}

/** Catalogue of pricing tiers (rendered on /plans). Fetches once. */
export function usePlans() {
  const getToken = useApiToken()
  const [data, setData] = useState<import('./types').Plan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const plans = await api.plans.list(token)
      setData(plans)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError(err instanceof Error ? err.message : 'Failed to load plans')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}


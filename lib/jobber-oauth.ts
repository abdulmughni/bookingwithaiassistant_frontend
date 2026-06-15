import type { Credential, Tenant } from '@/lib/types'

/** Query flag set by backend ``/oauth/jobber/launch`` or missing callback params. */
export const JOBBER_MARKETPLACE_QUERY = 'from_jobber'

/** Prevents redirect loops when Jobber bounces back without code/state. */
export const JOBBER_MARKETPLACE_GUARD_KEY = 'jobber_marketplace_oauth_started'

export function isJobberMarketplaceLaunch(searchParams: URLSearchParams): boolean {
  const v = searchParams.get(JOBBER_MARKETPLACE_QUERY)
  return v === '1' || v === 'true'
}

export function shouldKickstartJobberOAuth(
  tenant: Tenant | null,
  credentials: Credential[] | null,
): boolean {
  const jobberCred = credentials?.find((c) => c.integration_type === 'jobber')
  const linked =
    Boolean(jobberCred?.exists) &&
    tenant?.crm_type === 'jobber' &&
    tenant?.crm_credential_ref === jobberCred?.ref
  const needsReconnect =
    linked && Boolean(tenant?.crm_settings?.jobber_needs_reconnect)

  return !linked || needsReconnect
}

export function markJobberMarketplaceOAuthStarted(): void {
  try {
    sessionStorage.setItem(JOBBER_MARKETPLACE_GUARD_KEY, String(Date.now()))
  } catch {
    /* private mode / SSR */
  }
}

export function clearJobberMarketplaceOAuthGuard(): void {
  try {
    sessionStorage.removeItem(JOBBER_MARKETPLACE_GUARD_KEY)
  } catch {
    /* private mode / SSR */
  }
}

export function jobberMarketplaceOAuthAlreadyStarted(): boolean {
  try {
    const raw = sessionStorage.getItem(JOBBER_MARKETPLACE_GUARD_KEY)
    if (!raw) return false
    const startedAt = Number(raw)
    if (!Number.isFinite(startedAt)) return true
    // Allow a fresh kickstart after five minutes (user may have switched org).
    return Date.now() - startedAt < 5 * 60 * 1000
  } catch {
    return false
  }
}

/**
 * In-memory cache for the admin step-up verification token.
 *
 * The backend issues a 10-minute HMAC token after the admin re-enters their
 * password (POST /api/admin/verify-identity). We keep it in module memory only
 * — never localStorage — so it dies with the tab, which is exactly the
 * lifetime we want for a sensitive-action token.
 */

let cachedToken: string | null = null
let cachedExpiresAt = 0 // epoch seconds

/** Returns a still-valid token, or null when (re)verification is needed. */
export function getVerificationToken(): string | null {
  // 15s safety margin so a token doesn't expire mid-request.
  if (cachedToken && Date.now() / 1000 < cachedExpiresAt - 15) {
    return cachedToken
  }
  return null
}

export function storeVerificationToken(token: string, expiresAt: number): void {
  cachedToken = token
  cachedExpiresAt = expiresAt
}

export function clearVerificationToken(): void {
  cachedToken = null
  cachedExpiresAt = 0
}

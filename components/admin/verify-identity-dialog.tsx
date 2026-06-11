'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Field, Label } from '@/components/fieldset'
import { Input } from '@/components/input'
import { api } from '@/lib/api'
import { getVerificationToken, storeVerificationToken } from '@/lib/admin-verification'
import { useApiToken } from '@/lib/hooks'

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-5">
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/**
 * Step-up verification modal: the admin re-enters their OWN password before a
 * sensitive action (viewing a client profile, removing a client).
 *
 * On success, the short-lived backend token is cached in memory (10 min) and
 * passed to `onVerified`. If a still-valid cached token exists, the dialog
 * skips the password prompt entirely.
 */
export function VerifyIdentityDialog({
  open,
  onClose,
  onVerified,
  actionLabel = 'continue',
}: {
  open: boolean
  onClose: () => void
  /** Called with a valid verification token after a successful check. */
  onVerified: (verificationToken: string) => void
  /** Describes the action being unlocked, e.g. "view this client's profile". */
  actionLabel?: string
}) {
  const getToken = useApiToken()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setBusy(false)
      setError(null)
      return
    }
    // Already verified within the last 10 minutes — skip the prompt.
    const cached = getVerificationToken()
    if (cached) {
      onVerified(cached)
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleVerify = async () => {
    if (busy || !password.trim()) return
    setBusy(true)
    setError(null)
    try {
      const apiToken = await getToken()
      const result = await api.admin.verifyIdentity(apiToken, password)
      storeVerificationToken(result.verification_token, result.expires_at)
      onVerified(result.verification_token)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog size="md" open={open} onClose={() => (busy ? null : onClose())}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <LockIcon />
        </span>
        <DialogTitle>Confirm it&apos;s you</DialogTitle>
      </div>
      <DialogDescription>
        For your security, re-enter your password to {actionLabel}. Verification stays valid for 10
        minutes.
      </DialogDescription>
      <DialogBody>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleVerify()
          }}
        >
          <Field>
            <Label>Your password</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={busy}
              placeholder="••••••••"
            />
          </Field>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button color="brand" disabled={busy || !password.trim()} onClick={handleVerify}>
          {busy ? 'Verifying…' : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

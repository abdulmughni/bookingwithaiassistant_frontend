'use client'

import { useState } from 'react'
import { ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { toast } from 'sonner'

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
import type { ClientLoginCredentials } from '@/lib/types'

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`)
  }
}

/** Shows client login username + password (masked) with copy buttons. */
export function ClientLoginDialog({
  open,
  onClose,
  credentials,
  clientName,
}: {
  open: boolean
  onClose: () => void
  credentials: ClientLoginCredentials | null
  clientName: string
}) {
  const [busy, setBusy] = useState<'username' | 'password' | null>(null)

  if (!credentials) return null

  const handleCopy = async (kind: 'username' | 'password') => {
    setBusy(kind)
    try {
      const value = kind === 'username' ? credentials.username : credentials.password
      await copyText(kind === 'username' ? 'Username' : 'Password', value)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog size="md" open={open} onClose={onClose}>
      <DialogTitle>Client login credentials</DialogTitle>
      <DialogDescription>
        Use these to sign in to {clientName}&apos;s account in a separate tab. Copy each value
        below — the password is shown once and will not appear again.
      </DialogDescription>
      <DialogBody>
        <div className="space-y-4">
          <Field>
            <Label>Username (email)</Label>
            <div className="flex gap-2">
              <Input readOnly value={credentials.username} className="font-mono text-sm" />
              <Button
                outline
                type="button"
                disabled={busy !== null}
                onClick={() => void handleCopy('username')}
                aria-label="Copy username"
              >
                <ClipboardDocumentIcon className="size-4" />
                Copy
              </Button>
            </div>
          </Field>
          <Field>
            <Label>Password</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                type="password"
                value={credentials.password}
                className="font-mono text-sm tracking-widest"
              />
              <Button
                outline
                type="button"
                disabled={busy !== null}
                onClick={() => void handleCopy('password')}
                aria-label="Copy password"
              >
                <ClipboardDocumentIcon className="size-4" />
                Copy
              </Button>
            </div>
          </Field>
          {credentials.display_name ? (
            <p className="text-sm text-zinc-500">
              Account holder:{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {credentials.display_name}
              </span>
            </p>
          ) : null}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {credentials.warning}
          </p>
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="brand" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}

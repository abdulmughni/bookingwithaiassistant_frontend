'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Field, Label } from '@/components/fieldset'

/** Reusable destructive-action confirmation: user must type a phrase to enable delete.
 *
 * Defaults the typed phrase to "DELETE". Pass `confirmText` to require something else
 * (e.g. the resource name for high-stakes deletes).
 */
export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title = 'Delete this item?',
  description,
  itemLabel,
  confirmText = 'DELETE',
  busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title?: string
  description?: string
  itemLabel?: string
  confirmText?: string
  busy?: boolean
}) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const matches = typed.trim() === confirmText

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      {(description || itemLabel) && (
        <DialogDescription>
          {description}
          {itemLabel && (
            <>
              {description ? ' ' : ''}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{itemLabel}</span>
            </>
          )}
        </DialogDescription>
      )}
      <DialogBody>
        <Field>
          <Label>
            Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
          </Label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            placeholder={confirmText}
            disabled={busy}
          />
        </Field>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          color="red"
          onClick={() => {
            if (matches) onConfirm()
          }}
          disabled={!matches || busy}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

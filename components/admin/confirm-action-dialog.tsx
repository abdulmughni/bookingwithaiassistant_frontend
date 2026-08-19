'use client'

import { useState } from 'react'

import { Button } from '@/components/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'

/**
 * Generic "Are you sure?" modal for admin actions (activate, suspend, assign
 * plan, resolve/dismiss requests). Renders a title, a description, optional
 * extra body content, and Cancel / Confirm buttons. The confirm handler may be
 * async — the button shows a busy label until it settles.
 */
export function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  busyLabel = 'Working…',
  color = 'brand',
  children,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel: string
  busyLabel?: string
  /** Button color: 'brand' for positive, 'red' for destructive, etc. */
  color?: 'brand' | 'red' | 'green' | 'amber' | 'dark/zinc'
  children?: React.ReactNode
  onConfirm: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog size="md" open={open} onClose={() => (busy ? null : onClose())}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      {children ? <DialogBody>{children}</DialogBody> : null}
      <DialogActions>
        <Button plain disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button color={color} disabled={busy} onClick={handleConfirm}>
          {busy ? busyLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

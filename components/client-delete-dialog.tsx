'use client'

import { useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/button'
import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
} from '@/components/alert'
import { useApiToken } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Customer } from '@/lib/types'

export function ClientDeleteDialog({
  open,
  client,
  onClose,
  onDeleted,
}: {
  open: boolean
  client: Customer | null
  onClose: () => void
  onDeleted: () => void
}) {
  const getToken = useApiToken()
  const [busy, setBusy] = useState(false)

  const handleDelete = async () => {
    if (!client) return
    setBusy(true)
    try {
      const token = await getToken()
      await api.customers.delete(token, client.id)
      notifySuccess('Client deleted')
      onDeleted()
      onClose()
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Could not delete client')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Alert open={open} onClose={onClose} size="md">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200 sm:mx-0 dark:bg-red-500/10 dark:ring-red-500/30">
        <ExclamationTriangleIcon className="size-6 text-red-600 dark:text-red-400" aria-hidden />
      </div>
      <AlertTitle className="mt-4 sm:mt-0">Delete client?</AlertTitle>
      <AlertDescription>
        {client ? (
          <>
            This permanently removes{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {client.display_name}
            </span>{' '}
            from your client list. Past bookings stay in history but will no longer
            link to this profile.
          </>
        ) : (
          'This permanently removes the client profile.'
        )}
      </AlertDescription>
      <AlertActions>
        <Button plain onClick={onClose} disabled={busy}>
          Keep client
        </Button>
        <Button color="red" onClick={() => void handleDelete()} disabled={busy}>
          {busy ? 'Deleting…' : 'Delete client'}
        </Button>
      </AlertActions>
    </Alert>
  )
}

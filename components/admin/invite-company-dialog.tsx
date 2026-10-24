'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api'
import { useApiToken } from '@/lib/hooks'
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

export function InviteCompanyDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  submitLabel: string
  onSubmit: (token: string, input: { company_name: string; email: string }) => Promise<void>
}) {
  const getToken = useApiToken()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const token = await getToken()
      await onSubmit(token, { company_name: companyName.trim(), email: email.trim() })
      setCompanyName('')
      setEmail('')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send the invitation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? () => undefined : onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogBody>
        <div className="space-y-4">
          <Field>
            <Label>Company name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="brand"
          disabled={saving || !companyName.trim() || !email.trim()}
          onClick={() => void submit()}
        >
          {saving ? 'Sending…' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

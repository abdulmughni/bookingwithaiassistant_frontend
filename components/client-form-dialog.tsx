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
import { Field, FieldGroup, Label } from '@/components/fieldset'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { useApiToken } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Customer } from '@/lib/types'

export type ClientFormMode = 'create' | 'edit'

type FormState = {
  display_name: string
  phone: string
  email: string
  primary_address: string
  notes: string
}

const EMPTY: FormState = {
  display_name: '',
  phone: '',
  email: '',
  primary_address: '',
  notes: '',
}

function clientToForm(c: Customer): FormState {
  return {
    display_name: c.display_name || '',
    phone: c.phone || '',
    email: c.email || '',
    primary_address: c.primary_address || '',
    notes: c.notes || '',
  }
}

export function ClientFormDialog({
  open,
  mode,
  client,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: ClientFormMode
  client?: Customer | null
  onClose: () => void
  onSaved: (client: Customer) => void
}) {
  const getToken = useApiToken()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && client) {
      setForm(clientToForm(client))
      return
    }
    setForm(EMPTY)
  }, [open, mode, client])

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.display_name.trim()) {
      notifyError('Please enter a client name.')
      return
    }
    setSaving(true)
    try {
      const token = await getToken()
      const body = {
        display_name: form.display_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        primary_address: form.primary_address.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (mode === 'create') {
        const created = await api.customers.create(token, body)
        notifySuccess('Client created')
        onSaved(created)
        onClose()
      } else if (client) {
        const updated = await api.customers.update(token, client.id, body)
        notifySuccess('Client updated')
        onSaved(updated)
        onClose()
      }
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Could not save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{mode === 'create' ? 'New client' : 'Edit client'}</DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Add a customer profile you can link to future bookings.'
            : 'Update this client’s contact details and notes.'}
        </DialogDescription>

        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Name</Label>
              <Input
                required
                value={form.display_name}
                onChange={(e) => patch('display_name', e.target.value)}
                autoComplete="name"
                placeholder="Jane Doe"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => patch('phone', e.target.value)}
                  autoComplete="tel"
                  placeholder="+1…"
                />
              </Field>
              <Field>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => patch('email', e.target.value)}
                  autoComplete="email"
                />
              </Field>
            </div>
            <Field>
              <Label>Address</Label>
              <Input
                value={form.primary_address}
                onChange={(e) => patch('primary_address', e.target.value)}
                autoComplete="street-address"
              />
            </Field>
            <Field>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => patch('notes', e.target.value)}
                placeholder="Gate code, preferences…"
              />
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogActions>
          <Button type="button" plain onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" color="brand" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create client' : 'Save changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

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
import { useApiToken, useTenantTimezone } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  apiSlotToDatetimeLocal,
  datetimeLocalToApiSlot,
} from '@/lib/booking-calendar'
import type { Booking } from '@/lib/types'

export type BookingFormMode = 'create' | 'edit'

type FormState = {
  customer_name: string
  customer_phone: string
  customer_address: string
  service_type: string
  selected_slot: string
  notes: string
}

const EMPTY: FormState = {
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  service_type: '',
  selected_slot: '',
  notes: '',
}

function bookingToForm(booking: Booking, timeZone: string): FormState {
  return {
    customer_name: booking.customer_name || '',
    customer_phone: booking.customer_phone || '',
    customer_address: booking.customer_address || '',
    service_type: booking.service_type || '',
    selected_slot: apiSlotToDatetimeLocal(booking.selected_slot, timeZone),
    notes: booking.notes || '',
  }
}

export function BookingFormDialog({
  open,
  mode,
  booking,
  initialSlot,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: BookingFormMode
  booking?: Booking | null
  /** Prefill datetime-local when creating from a calendar slot click. */
  initialSlot?: string | null
  onClose: () => void
  onSaved: (booking: Booking) => void
}) {
  const getToken = useApiToken()
  const tenantTz = useTenantTimezone()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && booking) {
      setForm(bookingToForm(booking, tenantTz))
      return
    }
    setForm({
      ...EMPTY,
      selected_slot: initialSlot
        ? initialSlot.includes('T')
          ? initialSlot.slice(0, 16)
          : initialSlot
        : '',
    })
  }, [open, mode, booking, initialSlot, tenantTz])

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const slot = datetimeLocalToApiSlot(form.selected_slot)
    if (
      !form.customer_name.trim() ||
      !form.customer_phone.trim() ||
      !form.customer_address.trim() ||
      !form.service_type.trim() ||
      !slot
    ) {
      notifyError('Please fill in name, phone, address, service, and schedule.')
      return
    }

    setSaving(true)
    try {
      const token = await getToken()
      if (mode === 'create') {
        const created = await api.bookings.create(token, {
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_address: form.customer_address.trim(),
          service_type: form.service_type.trim(),
          selected_slot: slot,
          notes: form.notes.trim() || null,
        })
        notifySuccess('Booking created')
        onSaved(created)
        onClose()
      } else if (booking) {
        const updated = await api.bookings.update(token, booking.id, {
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_address: form.customer_address.trim(),
          service_type: form.service_type.trim(),
          selected_slot: slot,
          notes: form.notes.trim() || null,
        })
        notifySuccess('Booking updated')
        onSaved(updated)
        onClose()
      }
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Could not save booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{mode === 'create' ? 'New booking' : 'Edit booking'}</DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Create a booking on your schedule. Times use your workspace timezone.'
            : 'Update customer details or reschedule this appointment.'}
        </DialogDescription>

        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Customer name</Label>
              <Input
                required
                value={form.customer_name}
                onChange={(e) => patch('customer_name', e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field>
              <Label>Phone</Label>
              <Input
                required
                value={form.customer_phone}
                onChange={(e) => patch('customer_phone', e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field>
              <Label>Address</Label>
              <Input
                required
                value={form.customer_address}
                onChange={(e) => patch('customer_address', e.target.value)}
                autoComplete="street-address"
              />
            </Field>
            <Field>
              <Label>Service</Label>
              <Input
                required
                value={form.service_type}
                onChange={(e) => patch('service_type', e.target.value)}
                placeholder="e.g. HVAC tune-up"
              />
            </Field>
            <Field>
              <Label>Scheduled</Label>
              <Input
                required
                type="datetime-local"
                value={form.selected_slot}
                onChange={(e) => patch('selected_slot', e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Workspace timezone: {tenantTz}
              </p>
            </Field>
            <Field>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => patch('notes', e.target.value)}
                placeholder="Optional notes for the crew"
              />
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogActions>
          <Button type="button" plain onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" color="brand" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create booking' : 'Save changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

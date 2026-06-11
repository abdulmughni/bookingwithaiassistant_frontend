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
import { Switch } from '@/components/switch'
import type { AdminPlan, PlanWriteBody } from '@/lib/types'

const EMPTY: PlanWriteBody = {
  name: '',
  monthly_price_cents: 0,
  currency: 'USD',
  messages_quota: 0,
  call_minutes_quota: 0,
  validity_days: 180,
  features: [],
  best_for: '',
  is_featured: false,
  sort_order: 0,
  is_active: true,
}

function planToBody(plan: AdminPlan): PlanWriteBody {
  return {
    name: plan.name,
    monthly_price_cents: plan.monthly_price_cents,
    currency: plan.currency,
    messages_quota: plan.messages_quota,
    call_minutes_quota: plan.call_minutes_quota,
    validity_days: plan.validity_days,
    features: plan.features,
    best_for: plan.best_for,
    is_featured: plan.is_featured,
    sort_order: plan.sort_order,
    is_active: plan.is_active,
  }
}

/**
 * Create / edit modal for a prepaid credit pack. Price is entered in whole
 * dollars and converted to cents on submit. Features are one-per-line.
 */
export function PlanFormDialog({
  open,
  onClose,
  plan,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  /** When provided, the dialog edits this plan; otherwise it creates one. */
  plan?: AdminPlan | null
  onSubmit: (body: PlanWriteBody) => Promise<void>
}) {
  const isEdit = Boolean(plan)
  const [form, setForm] = useState<PlanWriteBody>(EMPTY)
  const [priceDollars, setPriceDollars] = useState('0')
  const [featuresText, setFeaturesText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const body = plan ? planToBody(plan) : EMPTY
    setForm(body)
    setPriceDollars(String((body.monthly_price_cents / 100) || 0))
    setFeaturesText(body.features.join('\n'))
  }, [open, plan])

  const set = <K extends keyof PlanWriteBody>(key: K, value: PlanWriteBody[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const dollars = Number.parseFloat(priceDollars)
      const body: PlanWriteBody = {
        ...form,
        name: form.name.trim(),
        monthly_price_cents: Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100)),
        features: featuresText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      await onSubmit(body)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const numberField = (
    key: 'messages_quota' | 'call_minutes_quota' | 'validity_days' | 'sort_order',
    label: string,
    hint?: string,
  ) => (
    <Field>
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={String(form[key])}
        onChange={(e) => set(key, Math.max(0, Number.parseInt(e.target.value || '0', 10)))}
      />
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </Field>
  )

  return (
    <Dialog size="2xl" open={open} onClose={() => (busy ? null : onClose())}>
      <DialogTitle>{isEdit ? `Edit ${plan?.name}` : 'Create a plan'}</DialogTitle>
      <DialogDescription>
        Prepaid credit packs grant a bucket of messages and call minutes that clients consume over
        the validity window.
      </DialogDescription>
      <DialogBody>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Standard"
              />
            </Field>
            <Field>
              <Label>Price (one-time, USD)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {numberField('messages_quota', 'Messages included')}
            {numberField('call_minutes_quota', 'Call minutes included')}
            {numberField('validity_days', 'Valid for (days)', 'e.g. 180 ≈ 6 months')}
          </div>

          <Field>
            <Label>Best for</Label>
            <Input
              value={form.best_for}
              onChange={(e) => set('best_for', e.target.value)}
              placeholder="Most HVAC, plumbing & roofing companies"
            />
          </Field>

          <Field>
            <Label>Features (one per line)</Label>
            <Textarea
              rows={4}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={'Smart booking\nCalendar sync\nConversation history'}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {numberField('sort_order', 'Sort order', 'Lower numbers appear first')}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
            <label className="flex items-center gap-3">
              <Switch
                color="amber"
                checked={form.is_featured}
                onChange={(v: boolean) => set('is_featured', v)}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Featured (★ tier)</span>
            </label>
            <label className="flex items-center gap-3">
              <Switch
                color="green"
                checked={form.is_active}
                onChange={(v: boolean) => set('is_active', v)}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Active (visible to clients)</span>
            </label>
          </div>
        </FieldGroup>
      </DialogBody>
      <DialogActions>
        <Button plain disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button color="brand" disabled={busy || !form.name.trim()} onClick={handleSubmit}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create plan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

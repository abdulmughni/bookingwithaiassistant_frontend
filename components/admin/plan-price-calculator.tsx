'use client'

import { useState } from 'react'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { dashCardClass } from '@/components/dashboard-ui'
import type { PlanWriteBody } from '@/lib/types'

function money(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Suggests a pack price from included minutes, messages, your cost, and markup. Nothing is charged. */
export function PlanPriceCalculator({
  audience,
  onUse,
}: {
  audience: 'agency' | 'admin'
  onUse: (body: PlanWriteBody) => void
}) {
  const [minutes, setMinutes] = useState('300')
  const [messages, setMessages] = useState('3000')
  const [minuteCost, setMinuteCost] = useState('0.10')
  const [messageCost, setMessageCost] = useState('0')
  const [markup, setMarkup] = useState('100')
  const mins = Math.max(0, Number(minutes) || 0)
  const msgs = Math.max(0, Number(messages) || 0)
  const perMinute = Math.max(0, Number(minuteCost) || 0)
  const perMessage = Math.max(0, Number(messageCost) || 0)
  const mark = Math.max(0, Number(markup) || 0)
  const cost = mins * perMinute + msgs * perMessage
  const price = cost * (1 + mark / 100)
  const profit = price - cost

  return (
    <section className={`${dashCardClass} p-5`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Price a pack</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {audience === 'agency'
              ? 'Work out what to charge a client for call minutes and messages. This does not take a payment. You still confirm the price when you save the pack.'
              : 'Work out a platform pack price from minutes, messages, and your cost. This does not take a payment. You still confirm the price when you save the pack.'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">What the pack includes</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Call minutes" hint="Minutes the client can use" value={minutes} onChange={setMinutes} />
            <Field label="Messages" hint="Messages the client can send" value={messages} onChange={setMessages} />
          </div>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">What it costs you</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Per minute" hint="Your cost" value={minuteCost} onChange={setMinuteCost} decimal />
            <Field label="Per message" hint="Your cost" value={messageCost} onChange={setMessageCost} decimal />
            <Field label="Your markup" hint="Percent you add" value={markup} onChange={setMarkup} decimal />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Your cost" value={money(cost)} detail="Minutes and messages at your rates" />
        <Summary label={audience === 'agency' ? 'Charge the client' : 'Pack price'} value={money(price)} detail="Your cost plus markup" emphasis />
        <Summary label="You keep" value={money(profit)} detail="Price minus your cost" />
      </div>

      <Button
        color="brand"
        className="mt-4"
        onClick={() =>
          onUse({
            name: '',
            monthly_price_cents: Math.round(price * 100),
            currency: 'USD',
            messages_quota: Math.round(msgs),
            call_minutes_quota: Math.round(mins),
            validity_days: 180,
            features: [],
            best_for: '',
            approx_calls: '',
            spam_calls_label: 'Free, no minutes',
            extra_minute_cents: Math.round(perMinute * (1 + mark / 100) * 100),
            messages_unlimited: false,
            is_featured: false,
            sort_order: 0,
            is_active: true,
          })
        }
      >
        Create a pack with this price
      </Button>
    </section>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  decimal = false,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  decimal?: boolean
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
      <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>
      <Input className="mt-1.5" inputMode={decimal ? 'decimal' : 'numeric'} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Summary({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string
  value: string
  detail: string
  emphasis?: boolean
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${emphasis ? 'bg-blue-50 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900/40' : 'bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700'}`}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  )
}

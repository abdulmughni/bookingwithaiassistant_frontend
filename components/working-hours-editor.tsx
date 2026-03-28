'use client'

import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/checkbox'
import { Field, Label, Description } from '@/components/fieldset'
import { Input } from '@/components/input'
import { Text } from '@/components/text'

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const

export type DayKey = (typeof DAYS)[number]['key']

export interface DayState {
  open: boolean
  start: string
  end: string
  /** When `open` is true: accept phone/chat on this day */
  callsActive: boolean
}

export type WorkingHoursState = Record<DayKey, DayState>

function emptyDay(): DayState {
  return { open: false, start: '09:00', end: '17:00', callsActive: true }
}

function parseWorkingHours(raw: Record<string, unknown> | null | undefined): WorkingHoursState {
  const base = Object.fromEntries(DAYS.map((d) => [d.key, emptyDay()])) as WorkingHoursState
  if (!raw || typeof raw !== 'object') return base

  for (const { key } of DAYS) {
    const v = raw[key]
    if (v === null || v === undefined) {
      base[key] = emptyDay()
      continue
    }
    if (typeof v === 'object' && v !== null && 'start' in v && 'end' in v) {
      const o = v as { start?: string; end?: string; calls?: boolean }
      base[key] = {
        open: true,
        start: typeof o.start === 'string' ? o.start : '09:00',
        end: typeof o.end === 'string' ? o.end : '17:00',
        callsActive: o.calls !== false,
      }
    }
  }
  return base
}

/** Build JSON for API: only open days; each value `{ start, end, calls? }` — omit `calls` if true */
export function serializeWorkingHours(state: WorkingHoursState): Record<string, { start: string; end: string; calls?: boolean }> {
  const out: Record<string, { start: string; end: string; calls?: boolean }> = {}
  for (const { key } of DAYS) {
    const d = state[key]
    if (!d.open) continue
    const block: { start: string; end: string; calls?: boolean } = {
      start: d.start,
      end: d.end,
    }
    if (!d.callsActive) block.calls = false
    out[key] = block
  }
  return out
}

export interface WorkingHoursEditorProps {
  value: Record<string, unknown>
  onChange: (next: Record<string, { start: string; end: string; calls?: boolean }>) => void
  className?: string
}

/**
 * 7-day grid: Open | Start | End | Calls active (only when open).
 * Closed days are grayed and omitted from serialized JSON.
 */
export function WorkingHoursEditor({ value, onChange, className }: WorkingHoursEditorProps) {
  const [state, setState] = useState<WorkingHoursState>(() => parseWorkingHours(value))

  const valueKey = JSON.stringify(value ?? {})
  useEffect(() => {
    setState(parseWorkingHours(value))
  }, [valueKey])

  const patch = (key: DayKey, partial: Partial<DayState>) => {
    setState((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], ...partial },
      }
      onChange(serializeWorkingHours(next))
      return next
    })
  }

  return (
    <div className={clsx('space-y-3', className)}>
      <div>
        <Label>Working hours</Label>
        <Description>
          Turn on each day you work, set start and end. Use the right column for days you accept{' '}
          <strong>calls / live chat</strong> (unchecked = business hours only, no call routing that day).
        </Description>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-950/10 dark:border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-950/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800/50">
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 font-medium">Open</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium text-right">Calls active</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map(({ key, label }) => {
              const d = state[key]
              const inactive = !d.open
              return (
                <tr
                  key={key}
                  className={clsx(
                    'border-b border-zinc-950/5 last:border-0 dark:border-white/5',
                    inactive && 'bg-zinc-100/80 text-zinc-400 dark:bg-zinc-900/80 dark:text-zinc-500',
                  )}
                >
                  <td className="px-3 py-2 font-medium text-zinc-950 dark:text-white">{label}</td>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={d.open}
                      onChange={(checked) =>
                        patch(key, {
                          open: checked,
                          // Default calls on when opening a day; keep prior when toggling off
                          callsActive: checked ? (d.open ? d.callsActive : true) : false,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="time"
                      value={d.start}
                      disabled={inactive}
                      onChange={(e) => patch(key, { start: e.target.value })}
                      className={inactive ? 'cursor-not-allowed' : ''}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="time"
                      value={d.end}
                      disabled={inactive}
                      onChange={(e) => patch(key, { end: e.target.value })}
                      className={inactive ? 'cursor-not-allowed' : ''}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end">
                      <Checkbox
                        checked={d.callsActive}
                        disabled={inactive}
                        onChange={(checked) => patch(key, { callsActive: checked })}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Text className="text-xs text-zinc-500">
        Closed days are not saved. The assistant integrations typically read{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">start</code> /{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">end</code>; optional{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">calls: false</code> marks a day
        without call coverage.
      </Text>
    </div>
  )
}

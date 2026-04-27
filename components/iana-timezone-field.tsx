'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Field, Label, Description } from '@/components/fieldset'
import { IANA_TIMEZONE_CUSTOM, IANA_TIMEZONE_GROUPS, isPresetIana } from '@/lib/iana-timezones'

export type IanaTimezoneFieldProps = {
  value: string
  onChange: (iana: string) => void
  id?: string
  label?: string
  description?: string
}

/** Browser IANA — used for the "Use detected zone" shortcut. */
function detectedTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof tz === 'string' && tz.trim() ? tz.trim() : 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Full IANA list from V8/ICU (Node 18+, all evergreen browsers). */
function supportedIanaZones(): string[] {
  try {
    const sv = (Intl as unknown as {
      supportedValuesOf?: (key: 'timeZone') => string[]
    }).supportedValuesOf
    return typeof sv === 'function' ? sv('timeZone') : []
  } catch {
    return []
  }
}

/** Render the current time + offset for `tz` so the user can sanity-check their pick. */
function formatPreview(tz: string): { time: string; offset: string } | null {
  if (!tz) return null
  try {
    const now = new Date()
    const time = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(now)
    const offsetParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now)
    const offset = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC'
    return { time, offset }
  } catch {
    return null
  }
}

/**
 * Dropdown of common US/Canada IANA zones plus optional custom IANA paste field.
 * Includes a live-time preview, browser auto-detect shortcut, and an autocomplete
 * datalist of every IANA zone supported by the runtime.
 *
 * Parent stores a single canonical `timezone` string (e.g. America/Chicago).
 */
export function IanaTimezoneField({
  value,
  onChange,
  id = 'tenant-timezone',
  label = 'Business timezone (IANA)',
  description = 'Bookings save in UTC; this zone is sent to Google Calendar and used to render local times in chat. Pick from the list or paste any IANA name.',
}: IanaTimezoneFieldProps) {
  const [selectKey, setSelectKey] = useState<string>(() =>
    isPresetIana(value) ? value : IANA_TIMEZONE_CUSTOM,
  )
  const [customText, setCustomText] = useState(() => (isPresetIana(value) ? '' : value.trim()))

  useEffect(() => {
    if (isPresetIana(value)) {
      setSelectKey(value)
      setCustomText('')
    } else {
      setSelectKey(IANA_TIMEZONE_CUSTOM)
      setCustomText(value.trim())
    }
  }, [value])

  const browserTz = useMemo(() => detectedTimezone(), [])
  const allZones = useMemo(() => supportedIanaZones(), [])
  const preview = useMemo(() => formatPreview(value || browserTz), [value, browserTz])

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    if (v === IANA_TIMEZONE_CUSTOM) {
      setSelectKey(IANA_TIMEZONE_CUSTOM)
      setCustomText((prev) => (prev.trim() ? prev : value.trim() || browserTz))
      return
    }
    setSelectKey(v)
    onChange(v)
  }

  const handleCustomBlur = () => {
    const t = customText.trim()
    if (t) onChange(t)
    else setCustomText(value.trim() || browserTz)
  }

  const handleCustomChange = (t: string) => {
    setCustomText(t)
    if (selectKey === IANA_TIMEZONE_CUSTOM && t.trim()) onChange(t.trim())
  }

  const useDetected = () => {
    if (!browserTz) return
    if (isPresetIana(browserTz)) {
      setSelectKey(browserTz)
      setCustomText('')
    } else {
      setSelectKey(IANA_TIMEZONE_CUSTOM)
      setCustomText(browserTz)
    }
    onChange(browserTz)
  }

  return (
    <Field>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {description ? <Description>{description}</Description> : null}
      <div className="mt-2 space-y-2">
        <Select
          id={id}
          name={id}
          value={selectKey}
          onChange={handleSelect}
          className="w-full"
        >
          {IANA_TIMEZONE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={IANA_TIMEZONE_CUSTOM}>Custom / other (enter IANA name below)…</option>
        </Select>

        {selectKey === IANA_TIMEZONE_CUSTOM ? (
          <div>
            <Input
              id={`${id}-custom`}
              name={`${id}-custom`}
              value={customText}
              onChange={(e) => handleCustomChange(e.target.value)}
              onBlur={handleCustomBlur}
              placeholder="e.g. Australia/Sydney, Africa/Johannesburg"
              className="font-mono text-sm"
              list={`${id}-iana-zones`}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            {allZones.length > 0 ? (
              <datalist id={`${id}-iana-zones`}>
                {allZones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Type to search any IANA zone (Region/City). Invalid values are rejected on save.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {preview ? (
              <>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {value || browserTz}
                </span>{' '}
                — {preview.time} <span className="font-mono">({preview.offset})</span>
              </>
            ) : (
              <span>Pick a zone to preview the current local time.</span>
            )}
          </span>
          {browserTz && browserTz !== value ? (
            <button
              type="button"
              onClick={useDetected}
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Use detected ({browserTz})
            </button>
          ) : null}
        </div>
      </div>
    </Field>
  )
}

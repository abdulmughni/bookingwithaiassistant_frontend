'use client'

import clsx from 'clsx'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/badge'
import { Label } from '@/components/fieldset'

export interface TagInputProps {
  label: string
  description?: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/** Type a value and press comma or Enter to add a tag. Tags are stored as string[] (API sends JSON arrays). */
export function TagInput({
  label,
  description,
  value,
  onChange,
  placeholder = 'Type and press comma…',
  className,
  disabled,
}: TagInputProps) {
  const [draft, setDraft] = useState('')

  const addTags = useCallback(
    (raw: string) => {
      const parts = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length === 0) return
      const next = [...value]
      for (const p of parts) {
        if (!next.includes(p)) next.push(p)
      }
      onChange(next)
    },
    [onChange, value],
  )

  const commitDraft = useCallback(() => {
    if (!draft.trim()) return
    addTags(draft)
    setDraft('')
  }, [addTags, draft])

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault()
      commitDraft()
      return
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeAt(value.length - 1)
    }
  }

  return (
    <div className={clsx(className)}>
      <Label>{label}</Label>
      {description && (
        <p className="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
      <div
        className={clsx(
          'mt-2 flex min-h-[42px] flex-wrap items-center gap-2 rounded-lg border border-zinc-950/10 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-zinc-900',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {value.map((tag, i) => (
          <Badge key={`${tag}-${i}`} color="zinc" className="gap-1 pr-1">
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                className="rounded p-0.5 hover:bg-zinc-200/80 dark:hover:bg-zinc-600"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            )}
          </Badge>
        ))}
        <input
          type="text"
          disabled={disabled}
          className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm outline-none focus:ring-0 dark:text-white"
          placeholder={value.length === 0 ? placeholder : ''}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commitDraft()}
        />
      </div>
    </div>
  )
}

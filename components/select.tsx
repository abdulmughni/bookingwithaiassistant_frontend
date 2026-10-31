'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef, useState } from 'react'

type Choice = { value: string; label: string; disabled: boolean }

function optionText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(optionText).join('')
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    return optionText(props.children)
  }
  return ''
}

function readChoices(children: React.ReactNode): Choice[] {
  const choices: Choice[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === 'optgroup') {
      const props = child.props as { children?: React.ReactNode }
      choices.push(...readChoices(props.children))
      return
    }
    if (child.type !== 'option') return
    const props = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode }
    const label = optionText(props.children)
    choices.push({
      value: props.value != null ? String(props.value) : label,
      label: label || (props.value != null ? String(props.value) : ''),
      disabled: Boolean(props.disabled),
    })
  })
  return choices
}

function emitChange(
  onChange: React.ChangeEventHandler<HTMLSelectElement> | undefined,
  value: string,
) {
  if (!onChange) return
  const target = { value }
  onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>)
}

/**
 * Styled menu. Native option popups on Windows clip the label and paint a
 * system highlight that does not follow the theme.
 */
export const Select = forwardRef(function Select(
  {
    className,
    children,
    value,
    defaultValue,
    onChange,
    disabled,
    name,
    autoFocus,
    required,
    'aria-label': ariaLabel,
  }: {
    className?: string
    children?: React.ReactNode
    value?: string | number
    defaultValue?: string | number
    onChange?: React.ChangeEventHandler<HTMLSelectElement>
    disabled?: boolean
    name?: string
    autoFocus?: boolean
    required?: boolean
    'aria-label'?: string
  },
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const choices = readChoices(children)
  const controlled = value !== undefined
  const [inner, setInner] = useState(defaultValue != null ? String(defaultValue) : (choices[0]?.value ?? ''))
  const current = controlled ? String(value ?? '') : inner
  const selected = choices.find((choice) => choice.value === current)

  return (
    <Headless.Listbox
      value={current}
      disabled={disabled}
      onChange={(next: string) => {
        if (!controlled) setInner(next)
        emitChange(onChange, next)
      }}
    >
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <Headless.ListboxButton
        ref={ref}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        data-slot="control"
        className={clsx(
          className,
          'group relative block w-full rounded-lg text-left',
          'border border-zinc-950/10 bg-white py-[calc(--spacing(2.5)-1px)] pr-9 pl-3 sm:py-[calc(--spacing(1.5)-1px)] sm:pl-2.5',
          'text-base/6 text-zinc-950 sm:text-sm/6',
          'dark:border-white/10 dark:bg-zinc-950/70 dark:text-white',
          'focus:outline-hidden data-focus:ring-2 data-focus:ring-blue-500',
          'data-disabled:opacity-50',
        )}
      >
        <span className="block truncate">{selected?.label || 'Choose'}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="size-4 stroke-zinc-500 dark:stroke-zinc-400"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
          >
            <path d="M5.75 10.75L8 13L10.25 10.75" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.25 5.25L8 3L5.75 5.25" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Headless.ListboxButton>
      <Headless.ListboxOptions
        anchor="bottom start"
        modal={false}
        className={clsx(
          'z-50 max-h-60 w-[var(--button-width)] overflow-auto rounded-xl p-1 [--anchor-gap:6px]',
          'bg-white text-zinc-950 shadow-lg ring-1 ring-zinc-950/10',
          'dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/15',
          'focus:outline-hidden',
        )}
      >
        {choices.map((choice, index) => (
          <Headless.ListboxOption
            key={`${index}-${choice.value}`}
            value={choice.value}
            disabled={choice.disabled}
            className={clsx(
              'cursor-pointer rounded-lg px-3 py-2 text-sm',
              'data-focus:bg-zinc-100 dark:data-focus:bg-zinc-800',
              'data-selected:font-semibold',
              'data-disabled:cursor-not-allowed data-disabled:opacity-40',
            )}
          >
            {choice.label}
          </Headless.ListboxOption>
        ))}
      </Headless.ListboxOptions>
    </Headless.Listbox>
  )
})

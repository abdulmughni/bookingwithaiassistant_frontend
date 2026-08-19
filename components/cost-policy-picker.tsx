'use client'

import type { ReactNode } from 'react'
import clsx from 'clsx'

import {
  COST_POLICY_COMMERCIAL_ADDON_TEXT,
  COST_POLICY_NO_WAIVE_FEE_TEXT,
  COST_POLICY_WAIVE_FEE_TEXT,
  type CostPolicyValue,
} from '@/lib/cost-policy'

type Props = {
  value: CostPolicyValue
  onChange: (next: CostPolicyValue) => void
  /** When true, show the full policy paragraphs under each control (admin). */
  showPolicyText?: boolean
  disabled?: boolean
  className?: string
}

function OptionCard({
  selected,
  onSelect,
  title,
  description,
  policyText,
  showPolicyText,
  disabled,
  input,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: string
  policyText?: string
  showPolicyText?: boolean
  disabled?: boolean
  input: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'w-full rounded-2xl border px-4 py-3.5 text-left transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        selected
          ? 'border-brand-500 bg-brand-50/70 shadow-sm ring-1 ring-brand-500/30 dark:border-brand-400 dark:bg-brand-950/30 dark:ring-brand-400/30'
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-600 dark:hover:bg-zinc-900',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{input}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-950 dark:text-white">{title}</span>
          <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">{description}</span>
          {showPolicyText && policyText ? (
            <span className="mt-2.5 block rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-400">
              {policyText}
            </span>
          ) : null}
        </span>
      </div>
    </button>
  )
}

export function CostPolicyPicker({
  value,
  onChange,
  showPolicyText = false,
  disabled = false,
  className,
}: Props) {
  return (
    <div className={clsx('space-y-3', className)}>
      <OptionCard
        selected={value.waive_diagnostic_fee}
        onSelect={() => onChange({ ...value, waive_diagnostic_fee: true })}
        title="Waive diagnostic fee"
        description="Fee is waived if they approve the repair on that visit (most residential shops)."
        policyText={COST_POLICY_WAIVE_FEE_TEXT}
        showPolicyText={showPolicyText}
        disabled={disabled}
        input={
          <span
            className={clsx(
              'flex size-4 items-center justify-center rounded-full border',
              value.waive_diagnostic_fee
                ? 'border-brand-600 bg-brand-600'
                : 'border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-900',
            )}
            aria-hidden
          >
            {value.waive_diagnostic_fee ? (
              <span className="size-1.5 rounded-full bg-white" />
            ) : null}
          </span>
        }
      />
      <OptionCard
        selected={!value.waive_diagnostic_fee}
        onSelect={() => onChange({ ...value, waive_diagnostic_fee: false })}
        title="Don't waive"
        description="Diagnostic fee always applies, whether or not they proceed with repair."
        policyText={COST_POLICY_NO_WAIVE_FEE_TEXT}
        showPolicyText={showPolicyText}
        disabled={disabled}
        input={
          <span
            className={clsx(
              'flex size-4 items-center justify-center rounded-full border',
              !value.waive_diagnostic_fee
                ? 'border-brand-600 bg-brand-600'
                : 'border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-900',
            )}
            aria-hidden
          >
            {!value.waive_diagnostic_fee ? (
              <span className="size-1.5 rounded-full bg-white" />
            ) : null}
          </span>
        }
      />
      <OptionCard
        selected={value.serves_commercial}
        onSelect={() =>
          onChange({ ...value, serves_commercial: !value.serves_commercial })
        }
        title="I also do commercial"
        description="Adds a commercial / multi-unit estimate line on top of your fee policy."
        policyText={COST_POLICY_COMMERCIAL_ADDON_TEXT}
        showPolicyText={showPolicyText}
        disabled={disabled}
        input={
          <span
            className={clsx(
              'flex size-4 items-center justify-center rounded border',
              value.serves_commercial
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-900',
            )}
            aria-hidden
          >
            {value.serves_commercial ? (
              <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
                <path
                  d="M2.5 6.2 4.8 8.5 9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
        }
      />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { APP_BRAND_NAME } from '@/lib/brand'

const JOBBER_LOGO = '/images/getjobber-logo.jpg'

const STEPS = [
  'Securing your workspace session',
  'Preparing OAuth connection',
  'Redirecting to Jobber',
] as const

function ConnectingPulse() {
  return (
    <span className="relative flex size-3">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400/70 opacity-60" />
      <span className="relative inline-flex size-3 rounded-full bg-brand-500" />
    </span>
  )
}

export function JobberConnectingOverlay({ open }: { open: boolean }) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      setStepIndex(0)
      return
    }
    const interval = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length)
    }, 2200)
    return () => window.clearInterval(interval)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Connecting to Jobber"
    >
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md dark:bg-zinc-950/65" />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl shadow-brand-500/10 ring-1 ring-zinc-950/5 dark:border-white/10 dark:bg-zinc-900/95 dark:shadow-black/50 dark:ring-white/10">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-lime-400/15 blur-3xl" />

        <div className="relative px-8 pb-8 pt-10 text-center">
          <div className="mx-auto flex max-w-xs items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 animate-spin rounded-2xl border-2 border-transparent border-t-brand-500/80 border-r-brand-400/40" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={JOBBER_LOGO}
                alt=""
                className="relative size-16 rounded-2xl border border-zinc-200/90 object-cover shadow-sm dark:border-zinc-600/80"
              />
            </div>

            <div className="flex flex-col items-center gap-1.5 px-1">
              <span className="h-px w-10 bg-linear-to-r from-transparent via-brand-400/70 to-transparent" />
              <div className="flex items-center gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:300ms]" />
              </div>
              <span className="h-px w-10 bg-linear-to-r from-transparent via-brand-400/70 to-transparent" />
            </div>

            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-lg shadow-brand-500/30">
              BL
            </div>
          </div>

          <h2 className="mt-8 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
            Connecting to Jobber
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Linking <span className="font-medium text-zinc-700 dark:text-zinc-300">{APP_BRAND_NAME}</span>{' '}
            with your Jobber account. You&apos;ll be asked to allow access on the next screen.
          </p>

          <div className="mt-8 flex items-center justify-center gap-2.5 rounded-2xl border border-zinc-950/5 bg-zinc-50/90 px-4 py-3 dark:border-white/10 dark:bg-zinc-800/50">
            <ConnectingPulse />
            <p
              key={stepIndex}
              className="jobber-connect-step text-sm font-medium text-zinc-700 dark:text-zinc-200"
            >
              {STEPS[stepIndex]}
              <span className="inline-block w-4 text-left text-brand-600 dark:text-brand-400">
                <span className="animate-pulse">…</span>
              </span>
            </p>
          </div>

          <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
            Please keep this tab open while we redirect you.
          </p>
        </div>

        <div className="relative h-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <div className="jobber-connect-progress h-full w-1/3 rounded-full bg-linear-to-r from-brand-500 to-brand-400" />
        </div>
      </div>
    </div>
  )
}

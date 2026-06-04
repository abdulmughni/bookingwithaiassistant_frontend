import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Heading } from '@/components/heading'

/** Standard dashboard card surface (Donezo-style). */
export const dashCardClass =
  'rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80'

export function PageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx('space-y-6', className)}>{children}</div>
}

export function PageHeader({
  title,
  description,
  children,
  centered,
}: {
  title: string
  description?: string
  children?: ReactNode
  centered?: boolean
}) {
  if (centered) {
    return (
      <header className="text-center">
        <Heading>{title}</Heading>
        {description ? (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-6 flex justify-center gap-2">{children}</div> : null}
      </header>
    )
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <Heading>{title}</Heading>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function FilterPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx(dashCardClass, 'p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-end gap-4">{children}</div>
    </div>
  )
}

export function PanelSection({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className={clsx(dashCardClass, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-700/80 sm:px-6">
        <div>
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function settingsTabClass(active: boolean): string {
  return clsx(
    'whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors',
    active
      ? 'border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400'
      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300',
  )
}

export function EmptyStatePanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        dashCardClass,
        'border-dashed border-zinc-300/90 py-14 text-center dark:border-zinc-600',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={clsx('animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800', className)}
    />
  )
}

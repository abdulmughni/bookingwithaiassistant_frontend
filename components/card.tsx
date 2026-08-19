import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={clsx('border-b border-zinc-950/10 px-5 py-4 dark:border-white/10 sm:px-6', className)} {...props} />
}

export function CardBody({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={clsx('p-5 sm:p-6', className)} {...props} />
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={clsx(
        'border-t border-zinc-950/10 px-5 py-4 dark:border-white/10 sm:px-6',
        className,
      )}
      {...props}
    />
  )
}

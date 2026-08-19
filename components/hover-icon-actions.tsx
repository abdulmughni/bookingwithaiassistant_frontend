'use client'

import clsx from 'clsx'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'

/**
 * Floating white action chip — appears on parent `group` hover.
 * Place parent with `group relative` and put this in a corner.
 */
export function HoverIconActions({
  className,
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: {
  className?: string
  onEdit?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
  editLabel?: string
  deleteLabel?: string
}) {
  if (!onEdit && !onDelete) return null

  return (
    <div
      className={clsx(
        'pointer-events-none absolute right-2.5 top-2.5 z-20 flex items-center gap-0.5',
        'rounded-xl border border-zinc-200/80 bg-white/95 p-0.5 shadow-lg shadow-zinc-950/10',
        'opacity-0 translate-y-0.5 scale-[0.96]',
        'transition-all duration-150 ease-out',
        'group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
        'group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100',
        'dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-black/40',
        className,
      )}
      role="group"
      aria-label="Quick actions"
    >
      {onEdit ? (
        <button
          type="button"
          title={editLabel}
          aria-label={editLabel}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onEdit(e)
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
        >
          <PencilSquareIcon className="size-4" aria-hidden />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          title={deleteLabel}
          aria-label={deleteLabel}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onDelete(e)
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <TrashIcon className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

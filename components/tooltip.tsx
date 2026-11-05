'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Shared hover label. Uses the `.app-tip` theme so light and dark stay readable. */
export function Tip({
  content,
  children,
  side = 'top',
  fill = false,
}: {
  content?: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  /** Stretch to the parent so a one-line ellipsis can measure overflow. */
  fill?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number } | null>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (content == null || content === '') return <>{children}</>

  function place(target: HTMLElement) {
    const rect = target.getBoundingClientRect()
    setBox({
      left: rect.left + rect.width / 2,
      top: side === 'bottom' ? rect.bottom + 8 : rect.top - 8,
    })
    setOpen(true)
  }

  return (
    <span
      className={fill ? 'flex w-full min-w-0 max-w-full' : 'inline-flex max-w-full min-w-0'}
      onMouseEnter={(event) => place(event.currentTarget)}
      onMouseLeave={() => setOpen(false)}
      onFocus={(event) => place(event.currentTarget)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && box
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              data-side={side}
              style={{ top: box.top, left: box.left }}
              className={`app-tip pointer-events-none fixed z-[80] max-w-xs -translate-x-1/2 px-2.5 py-1.5 text-left text-xs font-medium leading-snug ${
                side === 'bottom' ? '' : '-translate-y-full'
              }`}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}

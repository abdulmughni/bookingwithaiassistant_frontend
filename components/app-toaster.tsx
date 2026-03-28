'use client'

import { Toaster } from 'sonner'

/** Mount once in root layout — global success/error toasts. */
export function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'bg-white text-zinc-950 border border-zinc-950/10 dark:bg-zinc-900 dark:text-white dark:border-white/10',
        },
      }}
    />
  )
}

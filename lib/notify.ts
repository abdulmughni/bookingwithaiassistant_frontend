import { toast } from 'sonner'

/** Generic success — use after mutations that succeed. */
export function notifySuccess(message: string) {
  toast.success(message)
}

/** Generic error — use for validation, API failures, etc. */
export function notifyError(message: string) {
  toast.error(message)
}

export function notifyInfo(message: string) {
  toast.message(message)
}

/** Normalize unknown errors (e.g. from fetch) into a toast. */
export function notifyException(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof Error && err.message) {
    notifyError(err.message)
    return
  }
  notifyError(fallback)
}

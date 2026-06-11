'use client'

import { useClerk } from '@clerk/nextjs'
import { ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline'

import { Button } from '@/components/button'
import { Heading } from '@/components/heading'
import { Text } from '@/components/text'
import { useAccountStatus } from '@/lib/hooks'

/**
 * Gates the dashboard on the tenant's admin-managed ``account_status``:
 *  - ``suspended`` → full-screen "Account suspended" message (the user can
 *    still authenticate, but no dashboard/data is shown). Data APIs also 403.
 *  - ``pending`` / ``active`` (or unknown) → render the dashboard. Pending
 *    tenants additionally see {@link PendingActivationBanner} at the top.
 */
export function AccountStatusGate({ children }: { children: React.ReactNode }) {
  const { status, loading } = useAccountStatus()
  const { signOut } = useClerk()

  // Fail open while loading / on error so a transient hiccup never locks a
  // legitimate user out of their dashboard.
  if (loading || status !== 'suspended') {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-xl border border-zinc-950/10 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <ExclamationTriangleIcon className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <Heading className="mt-5">Account suspended</Heading>
        <Text className="mt-2">
          Your workspace has been deactivated and is not processing any messages
          or calls. Please contact support to reactivate your account.
        </Text>
        <div className="mt-8 flex justify-center">
          <Button outline onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Banner shown at the top of the dashboard while a tenant is ``pending`` —
 * they can explore the app, but no inbound traffic is processed until an admin
 * activates the account.
 */
export function PendingActivationBanner() {
  const { status } = useAccountStatus()
  if (status !== 'pending') return null

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
      <ClockIcon className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">Account pending activation</p>
        <p className="mt-0.5">
          You can set up your workspace now, but incoming messages and calls
          won&apos;t be handled until an administrator activates your account and
          assigns a plan.
        </p>
      </div>
    </div>
  )
}

'use client'

import { CreateOrganization, OrganizationSwitcher, useAuth } from '@clerk/nextjs'
import { Heading } from '@/components/heading'
import { Text } from '@/components/text'

/**
 * Backend APIs require a Clerk Organization (JWT org_id → tenant_id).
 * New accounts have no org until the user creates or joins one.
 */
export function OrganizationGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId, orgId } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    )
  }

  if (!userId) {
    return null
  }

  if (!orgId) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
        <div className="w-full max-w-lg rounded-xl border border-zinc-950/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <Heading>Create your workspace</Heading>
          <Text className="mt-2">
            This app links your data to a <strong>Clerk organization</strong> (your company
            workspace). Create one to continue — your APIs use its ID as{' '}
            <code className="rounded bg-zinc-100 px-1 text-sm dark:bg-zinc-800">tenant_id</code>.
          </Text>
          <Text className="mt-4 text-sm text-zinc-500">
            In Clerk Dashboard, ensure <strong>Organizations</strong> are enabled. The API creates
            your tenant record automatically on first authenticated request after you create a workspace.
          </Text>
          <div className="mt-8 flex justify-center">
            <CreateOrganization
              afterCreateOrganizationUrl="/"
              routing="hash"
              appearance={{
                elements: {
                  rootBox: 'mx-auto w-full',
                  card: 'shadow-none',
                },
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/** Compact switcher for the navbar — only useful when user has orgs. */
export function NavbarOrganizationSwitcher() {
  const { orgId } = useAuth()
  if (!orgId) return null
  return (
    <OrganizationSwitcher
      hidePersonal
      afterCreateOrganizationUrl="/"
      afterSelectOrganizationUrl="/"
      appearance={{
        elements: {
          rootBox: 'flex justify-end',
        },
      }}
    />
  )
}

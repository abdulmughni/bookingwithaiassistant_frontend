'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth, useUser, UserButton } from '@clerk/nextjs'
import {
  ChartBarSquareIcon,
  CreditCardIcon,
  InboxArrowDownIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

import { Navbar, NavbarSpacer } from '@/components/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/sidebar'
import { SidebarLayout } from '@/components/sidebar-layout'
import { useIsAdmin } from '@/lib/hooks'
import { BrandLogo } from '@/components/brand-logo'
import { brandGradientClass } from '@/lib/brand'

const adminNav = [
  { label: 'Overview', href: '/admin', icon: ChartBarSquareIcon, exact: true },
  { label: 'Clients', href: '/admin/clients', icon: UsersIcon, exact: false },
  { label: 'Plans', href: '/admin/plans', icon: CreditCardIcon, exact: false },
  { label: 'Plan requests', href: '/admin/requests', icon: InboxArrowDownIcon, exact: false },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth()
  const { user } = useUser()
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()
  const pathname = usePathname()

  const adminName =
    (user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '') ||
    user?.primaryEmailAddress?.emailAddress ||
    'Administrator'

  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace('/')
      return
    }
    if (isLoaded && userId && !loading && !isAdmin) {
      router.replace('/')
    }
  }, [isLoaded, userId, loading, isAdmin, router])

  if (!isLoaded || loading || !isAdmin) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
        <div className={`flex size-12 items-center justify-center rounded-2xl ${brandGradientClass}`}>
          <ShieldCheckIcon className="size-6 text-white" />
        </div>
        <div className="h-4 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    )
  }

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <UserButton />
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex flex-col gap-1 px-2 py-1.5">
              <BrandLogo height={26} priority className="max-w-[148px]" />
              <p className="truncate pl-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Admin Console
              </p>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {adminNav.map((item) => (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  current={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
                >
                  <item.icon data-slot="icon" />
                  <SidebarLabel>{item.label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSpacer />
          </SidebarBody>

          <SidebarFooter>
            <SidebarSection>
              <div className="flex items-center gap-3 px-2 py-1.5">
                <UserButton appearance={{ elements: { avatarBox: 'size-8' } }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                      {adminName}
                    </p>
                    <span className="inline-flex shrink-0 items-center rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                      Admin
                    </span>
                  </div>
                  <p className="truncate text-xs text-zinc-500">
                    {user?.primaryEmailAddress?.emailAddress ?? 'Platform owner'}
                  </p>
                </div>
              </div>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <div className="min-h-full bg-zinc-50/90 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 dark:bg-zinc-950">
        {children}
      </div>
    </SidebarLayout>
  )
}

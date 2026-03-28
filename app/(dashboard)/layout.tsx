'use client'

import { usePathname } from 'next/navigation'
import { useUser, useClerk, UserButton } from '@clerk/nextjs'
import { SidebarLayout } from '@/components/sidebar-layout'
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
import { Navbar, NavbarSpacer } from '@/components/navbar'
import { mainNavItems } from '@/lib/navigation'
import {
  ArrowRightStartOnRectangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/20/solid'
import {
  NavbarOrganizationSwitcher,
  OrganizationGate,
} from '@/components/organization-gate'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useClerk()

  const fullBleedPage =
    pathname === '/conversations' || pathname.startsWith('/conversations/')

  return (
    <OrganizationGate>
      <SidebarLayout
      contentViewportLocked={fullBleedPage}
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarOrganizationSwitcher />
          <UserButton />
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarSection>
              <SidebarItem href="/">
                <span className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-white text-xs font-bold dark:bg-white dark:text-zinc-950">
                    B
                  </span>
                  <SidebarLabel className="text-sm font-semibold">
                    BookingWithAI
                  </SidebarLabel>
                </span>
              </SidebarItem>
            </SidebarSection>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {mainNavItems.map((item) => (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  current={
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href)
                  }
                >
                  <item.icon data-slot="icon" />
                  <SidebarLabel>{item.label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem href="#">
                <QuestionMarkCircleIcon data-slot="icon" />
                <SidebarLabel>Support</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter>
            <SidebarSection>
              <SidebarItem
                onClick={() => signOut()}
              >
                <ArrowRightStartOnRectangleIcon data-slot="icon" />
                <SidebarLabel>Sign out</SidebarLabel>
              </SidebarItem>
              {user && (
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <UserButton
                    appearance={{
                      elements: { avatarBox: 'size-8' },
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {user.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>
              )}
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {fullBleedPage ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      )}
    </SidebarLayout>
    </OrganizationGate>
  )
}

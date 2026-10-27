'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, useUser, useClerk, useOrganization, UserButton } from '@clerk/nextjs'
import { SidebarLayout } from '@/components/sidebar-layout'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarNavGroup,
  SidebarSection,
  SidebarSpacer,
} from '@/components/sidebar'
import { Navbar, NavbarSpacer } from '@/components/navbar'
import { isNavGroupCurrent, isNavHrefCurrent, mainNavItems } from '@/lib/navigation'
import { useAgencyBrand, useIsAdmin } from '@/lib/hooks'
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid'
import {
  NavbarOrganizationSwitcher,
  OrganizationGate,
} from '@/components/organization-gate'
import {
  AccountStatusGate,
  PendingActivationBanner,
} from '@/components/account-status-gate'
import { SidebarUsageCard } from '@/components/sidebar-usage-card'
import { JobberReconnectBanner } from '@/components/jobber-reconnect-banner'
import { ClientOpsBanners } from '@/components/client-ops-banners'
import { NotificationBell } from '@/components/notification-bell'
import { RealtimeProvider } from '@/lib/realtime'
import { ShellBrand } from '@/components/brand-logo'
import { BrandTheme } from '@/components/brand-theme'
import { brandAssetUrl } from '@/lib/brand'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { actor } = useAuth()
  const { signOut } = useClerk()
  const { isAdmin, isAgency, loading: adminLoading } = useIsAdmin()
  const { brand, loading: brandLoading } = useAgencyBrand(!adminLoading && !isAdmin && !isAgency)

  const fullBleedPage =
    pathname === '/conversations' || pathname.startsWith('/conversations/')

  // Admins get the dedicated console — unless they are impersonating a client
  // (Clerk actor session opened from the admin "Open client account" action).
  const impersonating = Boolean(actor)
  useEffect(() => {
    if (!adminLoading && isAdmin && !impersonating) {
      router.replace('/admin')
    }
    if (!adminLoading && isAgency && !impersonating) {
      router.replace('/admin')
    }
  }, [adminLoading, isAdmin, isAgency, impersonating, router])

  if ((adminLoading || isAdmin || isAgency) && !impersonating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
      </div>
    )
  }

  return (
    <OrganizationGate>
      <AccountStatusGate>
      <RealtimeProvider>
      <BrandTheme theme={brand?.theme} />
      <SidebarLayout
      contentViewportLocked={fullBleedPage}
      desktopHeader={<NotificationBell />}
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NotificationBell />
          <NavbarOrganizationSwitcher />
          <UserButton />
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex min-w-0 flex-col gap-0 px-2 py-0.5">
              <ShellBrand
                loading={brandLoading || adminLoading}
                logoUrl={brandAssetUrl(brand?.logo_url)}
                name={brand?.company_name || organization?.name}
              />
              <p className="truncate pl-1 text-[11px] text-zinc-400">Client dashboard</p>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {mainNavItems.map((item) => {
                if (item.type === 'group') {
                  const groupActive = isNavGroupCurrent(item, pathname)
                  return (
                    <SidebarNavGroup
                      key={item.label}
                      label={item.label}
                      icon={item.icon}
                      active={groupActive}
                      pill
                    >
                      {item.children.map((child) => (
                        <SidebarItem
                          key={child.href}
                          href={child.href}
                          pill
                          current={isNavHrefCurrent(child.href, pathname)}
                        >
                          {child.icon ? <child.icon data-slot="icon" /> : null}
                          <SidebarLabel>{child.label}</SidebarLabel>
                        </SidebarItem>
                      ))}
                    </SidebarNavGroup>
                  )
                }

                return (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    pill
                    current={isNavHrefCurrent(item.href, pathname)}
                  >
                    <item.icon data-slot="icon" />
                    <SidebarLabel>{item.label}</SidebarLabel>
                  </SidebarItem>
                )
              })}
            </SidebarSection>

            <SidebarSpacer />

            {/* Support menu item intentionally hidden for now */}
          </SidebarBody>

          <SidebarFooter>
            <SidebarUsageCard />
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
        <div className="min-h-full bg-zinc-50/90 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 dark:bg-zinc-950">
          <PendingActivationBanner />
          <JobberReconnectBanner />
          <ClientOpsBanners />
          {children}
        </div>
      )}
    </SidebarLayout>
    </RealtimeProvider>
    </AccountStatusGate>
    </OrganizationGate>
  )
}

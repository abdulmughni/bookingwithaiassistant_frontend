'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth, useOrganization, useUser } from '@clerk/nextjs'
import clsx from 'clsx'
import { SidebarLayout } from '@/components/sidebar-layout'
import { SidebarBody, SidebarSpacer } from '@/components/sidebar'
import { PortalNavGroup, PortalNavLink, PortalProfileCard, PortalSidebarBrand, PortalSidebarShell } from '@/components/portal-sidebar'
import { Navbar, NavbarSpacer } from '@/components/navbar'
import { isNavGroupCurrent, isNavHrefCurrent, mainNavItems } from '@/lib/navigation'
import { AccountMenu } from '@/components/account-menu'
import { useAgencyBrand, useIsAdmin } from '@/lib/hooks'
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
import { BrandTheme } from '@/components/brand-theme'
import { CURRENT_THEME } from '@/lib/brand-presets'
import { brandAssetUrl } from '@/lib/brand'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { organization } = useOrganization()
  const { user } = useUser()
  const { actor } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    setCollapsed(window.localStorage.getItem('client-sidebar-collapsed') === '1')
  }, [])
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
      <BrandTheme theme={brand?.theme ?? CURRENT_THEME} />
      <SidebarLayout
      sidebarCard
      sidebarCollapsed={collapsed}
      contentViewportLocked={fullBleedPage}
      desktopHeader={pathname === '/' ? null : <NotificationBell />}
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NotificationBell />
          <NavbarOrganizationSwitcher />
          <AccountMenu portalName={organization?.name || 'Client'} compact />
        </Navbar>
      }
      sidebar={
        <PortalSidebarShell>
          <PortalSidebarBrand
            loading={brandLoading || adminLoading}
            logoUrl={brandAssetUrl(brand?.logo_url)}
            name={brand?.company_name || organization?.name || 'Client'}
            subtitle="Client dashboard"
            collapsed={collapsed}
            onToggle={() => {
              setCollapsed((value) => {
                const next = !value
                window.localStorage.setItem('client-sidebar-collapsed', next ? '1' : '0')
                return next
              })
            }}
          />
          <SidebarBody className={clsx('agency-scroll', collapsed ? 'px-2' : 'px-3')}>
            <nav className={clsx('flex flex-col', collapsed ? 'items-center gap-1' : 'gap-0.5')}>
              {mainNavItems.map((item) => {
                if (item.type === 'group') {
                  return (
                    <PortalNavGroup
                      key={item.label}
                      label={item.label}
                      icon={item.icon}
                      href={item.children[0]?.href ?? '/'}
                      current={isNavGroupCurrent(item, pathname)}
                      collapsed={collapsed}
                    >
                      {item.children.map((child) => (
                        <PortalNavLink
                          key={child.href}
                          href={child.href}
                          label={child.label}
                          icon={child.icon ?? item.icon}
                          collapsed={false}
                          current={isNavHrefCurrent(child.href, pathname)}
                        />
                      ))}
                    </PortalNavGroup>
                  )
                }
                return (
                  <PortalNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    current={isNavHrefCurrent(item.href, pathname)}
                  />
                )
              })}
            </nav>
            <SidebarSpacer />
          </SidebarBody>
          <div className={clsx('mt-auto', collapsed ? 'px-2 pb-3' : 'px-3 pb-3')}>
            <SidebarUsageCard compact={collapsed} />
            <PortalProfileCard
              title={organization?.name || brand?.company_name || 'Client'}
              subtitle={user?.primaryEmailAddress?.emailAddress ?? ''}
              compact={collapsed}
              menuTitle={organization?.name || brand?.company_name || 'Client'}
              menuLines={[{ label: 'Workspace', value: organization?.name || brand?.company_name || 'Client' }]}
            />
          </div>
        </PortalSidebarShell>
      }
    >
      {fullBleedPage ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        <div className="min-h-full bg-transparent px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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

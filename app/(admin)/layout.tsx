'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth, useUser, UserButton } from '@clerk/nextjs'
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  EnvelopeIcon,
  HomeIcon,
  InboxArrowDownIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SwatchIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

import { AgencyNotificationBell } from '@/components/admin/agency-notification-bell'

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
import { BrandLogo, ShellBrand } from '@/components/brand-logo'
import { BrandTheme } from '@/components/brand-theme'
import { UsageBar } from '@/components/admin/shared'
import { brandAssetUrl, brandGradientClass } from '@/lib/brand'
import { api } from '@/lib/api'
import { useAgencyBrand, useApiData, useIsAdmin } from '@/lib/hooks'

const superAdminNav = [
  { label: 'Overview', href: '/admin', icon: ChartBarSquareIcon, exact: true },
  { label: 'Agencies', href: '/admin/agencies', icon: BuildingOffice2Icon, exact: false },
  { label: 'Clients', href: '/admin/clients', icon: UsersIcon, exact: false },
  { label: 'Plans', href: '/admin/plans', icon: CreditCardIcon, exact: false },
  { label: 'Plan requests', href: '/admin/requests', icon: InboxArrowDownIcon, exact: false },
]

const agencyNav = [
  { label: 'Home', href: '/admin', icon: HomeIcon, exact: true },
  { label: 'Clients', href: '/admin/clients', icon: UsersIcon, exact: false },
  { label: 'Bookings', href: '/admin/activity?view=bookings', icon: CalendarDaysIcon, exact: false, view: 'bookings' },
  { label: 'Conversations', href: '/admin/activity?view=conversations', icon: ChatBubbleLeftRightIcon, exact: false, view: 'conversations' },
  { label: 'Calls', href: '/admin/activity?view=calls', icon: PhoneIcon, exact: false, view: 'calls' },
  { label: 'Messages', href: '/admin/activity?view=messages', icon: EnvelopeIcon, exact: false, view: 'messages' },
  { label: 'Team Members', href: '/admin/team', icon: UserGroupIcon, exact: false },
  { label: 'Brand & White Label', href: '/admin/settings?section=brand', icon: SwatchIcon, exact: false, section: 'brand' },
  { label: 'Billing & Plans', href: '/admin/credits', icon: CreditCardIcon, exact: false },
  { label: 'Billing', href: '/admin/billing', icon: BanknotesIcon, exact: false },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon, exact: true },
]

function agencyItemCurrent(
  item: { href: string; exact?: boolean; view?: string; section?: string },
  pathname: string,
  view: string | null,
  section: string | null,
) {
  if (item.view) return pathname.startsWith('/admin/activity') && view === item.view
  if (item.section) return pathname === '/admin/settings' && section === item.section
  if (item.exact && item.href === '/admin/settings') return pathname === '/admin/settings' && !section
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth()
  const { user } = useUser()
  const { isAdmin, isAgency, loading } = useIsAdmin()
  const { brand, loading: brandLoading } = useAgencyBrand(isAgency)
  const router = useRouter()
  const pathname = usePathname()
  const [view, setView] = useState<string | null>(null)
  const [section, setSection] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setView(params.get('view'))
    setSection(params.get('section'))
  }, [pathname])
  const allowed = isAdmin || isAgency
  const agencyBlocked =
    isAgency &&
    (pathname.startsWith('/admin/plans') ||
      pathname.startsWith('/admin/requests') ||
      pathname.startsWith('/admin/agencies'))
  const nav = isAgency ? agencyNav : superAdminNav

  const adminName =
    (user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '') ||
    user?.primaryEmailAddress?.emailAddress ||
    'Administrator'

  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace('/')
      return
    }
    if (isLoaded && userId && !loading && !allowed) {
      router.replace('/')
    }
    if (isLoaded && userId && !loading && agencyBlocked) {
      router.replace('/admin')
    }
  }, [isLoaded, userId, loading, allowed, agencyBlocked, router])

  if (!isLoaded || loading || !allowed || agencyBlocked) {
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
          {isAgency ? <AgencyNotificationBell /> : null}
          <UserButton />
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex min-w-0 flex-col gap-0 px-2 py-0.5">
              {isAgency ? (
                <ShellBrand
                  loading={brandLoading}
                  logoUrl={brandAssetUrl(brand?.logo_url)}
                  name={brand?.company_name}
                />
              ) : (
                <>
                  <BrandLogo height={31} priority className="max-w-44.5" />
                  <p className="truncate pl-[25px] text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
                    Admin Console
                  </p>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {nav.map((item) => (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  current={
                    isAgency
                      ? agencyItemCurrent(item, pathname, view, section)
                      : item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                  }
                >
                  <item.icon data-slot="icon" />
                  <SidebarLabel>{item.label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSpacer />
          </SidebarBody>

          <SidebarFooter>
            {isAgency ? <AgencyUsageCard /> : null}
            <SidebarSection>
              <div className="flex items-center gap-3 px-2 py-1.5">
                <UserButton appearance={{ elements: { avatarBox: 'size-8' } }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                      {adminName}
                    </p>
                    <span className="inline-flex shrink-0 items-center rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                      {isAgency ? 'Agency' : 'Admin'}
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
      {isAgency ? <BrandTheme theme={brand?.theme} /> : null}
      <div className="agency-canvas min-h-full bg-zinc-50/90 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 dark:bg-zinc-950">
        {children}
      </div>
    </SidebarLayout>
  )
}

function AgencyUsageCard() {
  const clients = useApiData((token) => api.admin.listTenants(token), [])
  const rows = clients.data ?? []
  const used = rows.reduce((sum, client) => sum + (client.usage?.call_minutes_used ?? 0), 0)
  const quota = rows.reduce((sum, client) => sum + (client.usage?.call_minutes_quota ?? 0), 0)

  return (
    <div className="mb-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-xs font-semibold text-zinc-950 dark:text-white">Usage</p>
      <p className="mt-2 text-xs text-zinc-500">{rows.length.toLocaleString()} clients</p>
      <div className="mt-2">
        <UsageBar used={used} quota={quota} label="Call minutes" />
      </div>
      <Link
        href="/admin/credits"
        className="mt-3 flex items-center justify-center rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
      >
        Manage plans
      </Link>
    </div>
  )
}

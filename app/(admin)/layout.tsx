'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth, useUser, UserButton } from '@clerk/nextjs'
import {
  ArrowPathIcon,
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
  SparklesIcon,
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
import { brandAssetUrl, brandGradientClass } from '@/lib/brand'
import { useAgencyDemo } from '@/lib/agency-dashboard-demo'
import { useAgencyBrand, useApiData, useIsAdmin } from '@/lib/hooks'
import { api } from '@/lib/api'

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
  { label: 'AI Assistants', href: '/admin/activity?view=assistants', icon: SparklesIcon, exact: false, view: 'assistants' },
  { label: 'Team Members', href: '/admin/team', icon: UserGroupIcon, exact: false },
  { label: 'Billing & Plans', href: '/admin/credits', icon: CreditCardIcon, exact: false },
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
  if (item.exact && item.href === '/admin/settings') return pathname === '/admin/settings'
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
                <div className="min-w-0">
                  <ShellBrand
                    loading={brandLoading}
                    logoUrl={brandAssetUrl(brand?.logo_url)}
                    name={brand?.company_name}
                  />
                  <p className="truncate pl-1 text-[11px] text-zinc-400">Agency dashboard</p>
                </div>
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
                  pill
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
            {isAgency ? <AgencyPlanCard /> : null}
            <SidebarSection>
              <div className="flex items-center gap-3 px-2 py-1.5">
                <UserButton appearance={{ elements: { avatarBox: 'size-8' } }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                    {isAgency ? brand?.company_name || adminName : adminName}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {isAgency
                      ? (user?.primaryEmailAddress?.emailAddress ?? 'Platform owner')
                      : 'Super Admin'}
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

function AgencyPlanCard() {
  const { enabled } = useAgencyDemo()
  const clients = useApiData((token) => api.admin.listTenants(token), [])
  const [refreshing, setRefreshing] = useState(false)
  const rows = clients.data ?? []
  const messageUsed = rows.reduce((sum, client) => sum + (client.usage?.messages_used ?? 0), 0)
  const messageQuota = rows.reduce(
    (sum, client) => sum + (client.plan?.messages_unlimited ? 0 : client.usage?.messages_quota ?? 0),
    0,
  )
  const minuteUsed = rows.reduce((sum, client) => sum + (client.usage?.call_minutes_used ?? 0), 0)
  const minuteQuota = rows.reduce((sum, client) => sum + (client.usage?.call_minutes_quota ?? 0), 0)
  const names = rows.map((client) => client.plan?.name).filter((name): name is string => Boolean(name))
  const planName = names.sort((a, b) => names.filter((name) => name === b).length - names.filter((name) => name === a).length)[0] || 'No pack'
  const expiries = rows
    .map((client) => client.subscription_expires_at)
    .filter((value): value is string => Boolean(value))
    .sort()
  const expiry = expiries[0]
  const expiryLabel = expiry
    ? new Date(expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  const view = enabled
    ? {
        name: 'Standard',
        featured: true,
        until: 'Apr 14, 2027',
        messages: { used: 12, quota: 6000 },
        minutes: { used: 53, quota: 600 },
      }
    : {
        name: planName,
        featured: false,
        until: expiryLabel,
        messages: { used: messageUsed, quota: messageQuota },
        minutes: { used: minuteUsed, quota: minuteQuota },
      }

  return (
    <div className="mb-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold tracking-wide text-zinc-400">YOUR PLAN</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {view.name}
            {view.featured ? <span className="text-[10px] text-amber-500">★</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {view.until ? (
              <>
                Credits valid until <span className="font-medium text-zinc-700 dark:text-zinc-300">{view.until}</span>
              </>
            ) : (
              'Prepaid credit pack'
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh usage numbers"
          title="Refresh usage"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true)
            void clients.refetch().finally(() => setRefreshing(false))
          }}
          className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
        >
          <ArrowPathIcon className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-zinc-950/5 dark:bg-zinc-800/40">
        <UsageMeter icon={<ChatBubbleLeftRightIcon className="size-3.5" />} label="Messages" used={view.messages.used} quota={view.messages.quota} />
        <UsageMeter icon={<PhoneIcon className="size-3.5" />} label="Voice minutes" used={view.minutes.used} quota={view.minutes.quota} />
      </div>
      <Link href="/admin/credits" className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
        Manage plan
        <span aria-hidden>↗</span>
      </Link>
    </div>
  )
}

function UsageMeter({
  icon,
  label,
  used,
  quota,
}: {
  icon: ReactNode
  label: string
  used: number
  quota: number
}) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0
  const remaining = Math.max(0, quota - used)
  const warning = pct >= 80
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span className="text-brand-600">{icon}</span>
          {label}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${warning ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-700'}`}>
          {quota > 0 && used >= quota ? 'Used up' : warning ? 'Almost gone' : 'On track'}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between tabular-nums">
        <span className="text-sm font-semibold text-zinc-950 dark:text-white">{pct}%</span>
        <span className="text-[10px] text-zinc-500">
          {used.toLocaleString()} / {quota > 0 ? quota.toLocaleString() : '—'}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-100">
        <div className={`h-full rounded-full ${warning ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">{quota > 0 ? `${remaining.toLocaleString()} remaining` : 'No pack assigned'}</p>
    </div>
  )
}

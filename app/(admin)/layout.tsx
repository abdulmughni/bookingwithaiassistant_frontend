'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
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

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

import { AccountMenu } from '@/components/account-menu'
import { AgencyNotificationBell } from '@/components/admin/agency-notification-bell'

import { Navbar, NavbarSpacer } from '@/components/navbar'
import { Sidebar, SidebarBody, SidebarSpacer } from '@/components/sidebar'
import { PortalNavLink, PortalProfileCard, PortalSidebarBrand, PortalSidebarShell } from '@/components/portal-sidebar'
import { SidebarLayout } from '@/components/sidebar-layout'
import { BrandLogo } from '@/components/brand-logo'
import { BrandTheme } from '@/components/brand-theme'
import { CURRENT_THEME } from '@/lib/brand-presets'
import { useConsoleTheme } from '@/lib/console-theme'
import { brandAssetUrl, brandGradientClass } from '@/lib/brand'
import { useAgencyDemo } from '@/lib/agency-dashboard-demo'
import { useAgencyBrand, useApiData, useIsAdmin } from '@/lib/hooks'
import { api } from '@/lib/api'

const superAdminNav = [
  { label: 'Dashboard', href: '/admin', icon: ChartBarSquareIcon, exact: true },
  { label: 'Agencies', href: '/admin/agencies', icon: BuildingOffice2Icon, exact: false },
  { label: 'Clients', href: '/admin/clients', icon: UsersIcon, exact: false },
  { label: 'Plans', href: '/admin/plans', icon: CreditCardIcon, exact: false },
  { label: 'Plan requests', href: '/admin/requests', icon: InboxArrowDownIcon, exact: false },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon, exact: true },
]

const agencyNav = [
  { label: 'Dashboard', href: '/admin', icon: HomeIcon, exact: true },
  { label: 'Clients', href: '/admin/clients', icon: UsersIcon, exact: false },
  { label: 'Bookings', href: '/admin/activity?view=bookings', icon: CalendarDaysIcon, exact: false, view: 'bookings' },
  { label: 'Conversations', href: '/admin/activity?view=conversations', icon: ChatBubbleLeftRightIcon, exact: false, view: 'conversations' },
  { label: 'Calls', href: '/admin/activity?view=calls', icon: PhoneIcon, exact: false, view: 'calls' },
  { label: 'Messages', href: '/admin/activity?view=messages', icon: EnvelopeIcon, exact: false, view: 'messages' },
  { label: 'AI Assistants', href: '/admin/activity?view=assistants', icon: SparklesIcon, exact: false, view: 'assistants' },
  { label: 'Team Members', href: '/admin/team', icon: UserGroupIcon, exact: false },
  { label: 'Plans & billing', href: '/admin/credits', icon: CreditCardIcon, exact: false },
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
  const { isAdmin, isAgency, isAgencyStaff, loading } = useIsAdmin()
  const { brand, loading: brandLoading } = useAgencyBrand(isAgency)
  const consoleTheme = useConsoleTheme()
  const router = useRouter()
  const pathname = usePathname()
  const [view, setView] = useState<string | null>(null)
  const [section, setSection] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [adminCollapsed, setAdminCollapsed] = useState(false)
  useEffect(() => {
    if (isAgency) {
      setCollapsed(window.localStorage.getItem('agency-sidebar-collapsed') === '1')
      return
    }
    setAdminCollapsed(window.localStorage.getItem('admin-sidebar-collapsed') === '1')
  }, [isAgency])
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
  const portalName = isAgency ? brand?.company_name || 'Agency' : 'Admin portal'

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
      sidebarCollapsed={isAgency ? collapsed : adminCollapsed}
      sidebarCard
      navbar={
        <Navbar>
          <NavbarSpacer />
          {isAgency ? <AgencyNotificationBell /> : <AccountMenu portalName={portalName} compact />}
        </Navbar>
      }
      sidebar={
        isAgency ? (
          <Sidebar className="rounded-[28px] bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] ring-1 ring-zinc-200/80">
            <AgencySidebarBrand
              loading={brandLoading}
              logoUrl={brandAssetUrl(brand?.logo_url)}
              name={brand?.company_name || 'Agency'}
              collapsed={collapsed}
              onToggle={() => {
                setCollapsed((value) => {
                  const next = !value
                  window.localStorage.setItem('agency-sidebar-collapsed', next ? '1' : '0')
                  return next
                })
              }}
            />
            <SidebarBody className={clsx('agency-scroll', collapsed ? 'px-2' : 'px-3')}>
              <nav className={clsx('flex flex-col', collapsed ? 'items-center gap-1' : 'gap-0.5')}>
                {agencyNav.map((item) => (
                  <AgencyNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    current={agencyItemCurrent(item, pathname, view, section)}
                  />
                ))}
              </nav>
              <SidebarSpacer />
            </SidebarBody>
            <div className={clsx('mt-auto', collapsed ? 'px-2 pb-3' : 'px-3 pb-3')}>
              <AgencyPlanCard compact={collapsed} />
              <AgencyProfileCard agencyName={portalName} compact={collapsed} staff={isAgencyStaff} />
            </div>
          </Sidebar>
        ) : (
          <PortalSidebarShell>
            <PortalSidebarBrand
              name="Beyonds Logic"
              subtitle="Admin portal"
              mark="B"
              collapsed={adminCollapsed}
              onToggle={() => {
                setAdminCollapsed((value) => {
                  const next = !value
                  window.localStorage.setItem('admin-sidebar-collapsed', next ? '1' : '0')
                  return next
                })
              }}
            />
            <SidebarBody className={clsx('agency-scroll', adminCollapsed ? 'px-2' : 'px-3')}>
              <nav className={clsx('flex flex-col', adminCollapsed ? 'items-center gap-1' : 'gap-0.5')}>
                {superAdminNav.map((item) => (
                  <PortalNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    collapsed={adminCollapsed}
                    current={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
                  />
                ))}
              </nav>
              <SidebarSpacer />
            </SidebarBody>
            <div className={clsx('mt-auto', adminCollapsed ? 'px-2 pb-3' : 'px-3 pb-3')}>
              <PortalProfileCard
                title={portalName}
                subtitle={''}
                compact={adminCollapsed}
                menuTitle={portalName}
                menuLines={[{ label: 'Portal', value: 'Admin portal' }]}
              />
            </div>
          </PortalSidebarShell>
        )
      }
    >
      <BrandTheme theme={isAgency ? (brand?.theme ?? CURRENT_THEME) : consoleTheme} />
      <div
        className={
          'min-h-full overflow-x-hidden bg-transparent px-4 py-6 sm:px-6 lg:px-8 lg:py-8'
        }
      >
        {children}
      </div>
    </SidebarLayout>
  )
}

function AgencySidebarBrand({
  loading,
  logoUrl,
  name,
  collapsed,
  onToggle,
}: {
  loading: boolean
  logoUrl?: string | null
  name: string
  collapsed: boolean
  onToggle: () => void
}) {
  const mark = (name.trim()[0] || 'A').toUpperCase()
  return (
    <div className={clsx('flex items-center gap-2', collapsed ? 'flex-col px-2 pt-3' : 'px-4 pt-4')}>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
        {loading ? null : logoUrl ? (
          <BrandLogo src={logoUrl} alt="" height={40} className="size-10 max-w-10 object-cover" />
        ) : (
          mark
        )}
      </span>
      {collapsed ? null : (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-950">{name}</span>
          <span className="block truncate text-[11px] text-zinc-400">Agency portal</span>
        </span>
      )}
      <button
        type="button"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggle}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition duration-200 hover:bg-blue-50 hover:text-blue-600"
      >
        {collapsed ? <ChevronDoubleRightIcon className="size-4" /> : <ChevronDoubleLeftIcon className="size-4" />}
      </button>
    </div>
  )
}

function AgencyNavLink({
  href,
  label,
  icon: Icon,
  current,
  collapsed,
}: {
  href: string
  label: string
  icon: typeof HomeIcon
  current: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={current ? 'page' : undefined}
      className={clsx(
        'group flex items-center rounded-xl text-sm font-medium transition duration-200',
        collapsed ? 'size-10 justify-center' : 'gap-3 px-3 py-2',
        current
          ? 'bg-blue-50 text-blue-700 shadow-sm'
          : 'text-zinc-600 hover:bg-blue-50/80 hover:text-blue-700',
      )}
    >
      <Icon
        className={clsx(
          'size-5 shrink-0 transition duration-200 group-hover:scale-110',
          current ? 'text-blue-600' : 'text-zinc-400 group-hover:text-blue-600',
        )}
      />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </Link>
  )
}

function AgencyPlanCard({ compact = false }: { compact?: boolean }) {
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

  if (compact) {
    return (
      <Link
        href="/admin/credits"
        title="Your plan"
        className="mx-auto mb-2 flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 transition duration-200 hover:scale-105 hover:bg-blue-100"
      >
        <CreditCardIcon className="size-5" />
      </Link>
    )
  }

  return (
    <div className="agency-plan mb-3 rounded-2xl p-3 shadow-sm ring-1 ring-zinc-200/80">
      <p className="text-[10px] font-semibold tracking-wide text-zinc-400">YOUR PLAN</p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {view.name}
            {view.featured ? <span className="text-[10px] text-amber-500">★</span> : null}
            {view.featured || view.name !== 'No pack' ? (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Active</span>
            ) : null}
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
      <Link
        href="/admin/credits"
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition duration-200 hover:bg-blue-700"
      >
        Manage Plan
        <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

function AgencyProfileCard({
  agencyName,
  compact,
  staff,
}: {
  agencyName: string
  compact: boolean
  staff: boolean
}) {
  const { user } = useUser()
  const { openUserProfile, signOut } = useClerk()
  if (!user) return null
  const email = user.primaryEmailAddress?.emailAddress ?? ''
  const name = user.fullName || user.firstName || email || 'Account'
  const role = staff ? 'Team member' : 'Agency owner'
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const avatar = (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-xs font-semibold text-blue-700 ring-2 ring-white">
      {user.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        initials || 'A'
      )}
    </span>
  )

  return (
    <Menu as="div" className={clsx('relative', compact && 'flex justify-center')}>
      <MenuButton
        title={compact ? email || name : undefined}
        className={clsx(
          'flex items-center text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
          compact
            ? 'size-10 justify-center rounded-full'
            : 'agency-plan w-full gap-2.5 rounded-2xl p-3 shadow-sm ring-1 ring-zinc-200/80',
        )}
      >
        {avatar}
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-800">{email || name}</span>
              <span className="block truncate text-[11px] text-zinc-400">{role}</span>
            </span>
            <span className="shrink-0 text-zinc-300" aria-hidden>›</span>
          </>
        )}
      </MenuButton>
      <MenuItems
        transition
        anchor="top start"
        className="z-50 w-72 origin-bottom rounded-2xl bg-white p-2 shadow-xl ring-1 ring-zinc-200 transition duration-200 ease-out [--anchor-gap:10px] focus:outline-none data-closed:scale-95 data-closed:opacity-0"
      >
        <div className="flex items-center gap-3 rounded-xl bg-blue-50/60 px-2.5 py-2.5">
          {avatar}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">{name}</p>
            <p className="truncate text-xs text-zinc-500">{email}</p>
          </div>
        </div>
        <div className="mt-2 space-y-1 px-2.5 py-1 text-xs text-zinc-500">
          <p><span className="font-medium text-zinc-700">Role</span> · {role}</p>
          <p className="truncate"><span className="font-medium text-zinc-700">Agency</span> · {agencyName}</p>
        </div>
        <div className="my-1 h-px bg-zinc-100" />
        <MenuItem>
          <button
            type="button"
            onClick={() => openUserProfile()}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 data-focus:bg-blue-50 data-focus:text-blue-700"
          >
            Manage account
          </button>
        </MenuItem>
        <MenuItem>
          <button
            type="button"
            onClick={() => void signOut()}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 data-focus:bg-blue-50 data-focus:text-blue-700"
          >
            Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
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
        <div
          className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${warning ? 'bg-amber-500' : 'bg-brand-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">{quota > 0 ? `${remaining.toLocaleString()} remaining` : 'No pack assigned'}</p>
    </div>
  )
}

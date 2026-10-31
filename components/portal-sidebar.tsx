'use client'

import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react'
import clsx from 'clsx'
import { useClerk, useUser } from '@clerk/nextjs'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

import { Sidebar } from '@/components/sidebar'
import { BrandLogo } from '@/components/brand-logo'
import { Link } from '@/components/link'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>

export function PortalSidebarShell({ children }: { children: ReactNode }) {
  return (
    <Sidebar className="rounded-[28px] bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] ring-1 ring-zinc-200/80">
      {children}
    </Sidebar>
  )
}

export function PortalSidebarBrand({
  loading,
  logoUrl,
  name,
  subtitle,
  collapsed,
  onToggle,
  mark,
}: {
  loading?: boolean
  logoUrl?: string | null
  name: string
  subtitle: string
  collapsed: boolean
  onToggle: () => void
  mark?: string
}) {
  const letter = (mark || name.trim()[0] || 'A').toUpperCase()
  return (
    <div className={clsx('flex items-center gap-2', collapsed ? 'flex-col px-2 pt-3' : 'px-4 pt-4')}>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
        {loading ? null : logoUrl ? (
          <BrandLogo src={logoUrl} alt="" height={40} className="size-10 max-w-10 object-cover" />
        ) : (
          letter
        )}
      </span>
      {collapsed ? null : (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-950">{name}</span>
          <span className="block truncate text-[11px] text-zinc-400">{subtitle}</span>
        </span>
      )}
      <button
        type="button"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggle}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition duration-200 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
      >
        {collapsed ? <ChevronDoubleRightIcon className="size-4" /> : <ChevronDoubleLeftIcon className="size-4" />}
      </button>
    </div>
  )
}

export function PortalNavLink({
  href,
  label,
  icon: Icon,
  current,
  collapsed,
}: {
  href: string
  label: string
  icon: HeroIcon
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
        current ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-zinc-600 hover:bg-blue-50/80 hover:text-blue-700',
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

export function PortalNavGroup({
  label,
  icon: Icon,
  href,
  current,
  collapsed,
  children,
}: {
  label: string
  icon: HeroIcon
  href: string
  current: boolean
  collapsed: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(current)
  useEffect(() => {
    if (current) setOpen(true)
  }, [current])

  if (collapsed) {
    return <PortalNavLink href={href} label={label} icon={Icon} current={current} collapsed />
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={clsx(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition duration-200',
          current ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-zinc-600 hover:bg-blue-50/80 hover:text-blue-700',
        )}
      >
        <Icon
          className={clsx(
            'size-5 shrink-0 transition duration-200 group-hover:scale-110',
            current ? 'text-blue-600' : 'text-zinc-400 group-hover:text-blue-600',
          )}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDownIcon className={clsx('size-4 shrink-0 text-zinc-400 transition', open && 'rotate-180')} />
      </button>
      {open ? <div className="ml-4 flex flex-col gap-0.5 border-l border-zinc-200 pl-2">{children}</div> : null}
    </div>
  )
}

export function PortalProfileCard({
  title,
  subtitle,
  compact,
  menuTitle,
  menuLines,
}: {
  title: string
  subtitle: string
  compact: boolean
  menuTitle: string
  menuLines: { label: string; value: string }[]
}) {
  const { user } = useUser()
  const { openUserProfile, signOut } = useClerk()
  if (!user) return null
  const email = user.primaryEmailAddress?.emailAddress ?? ''
  const name = user.fullName || user.firstName || email || title
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
        title={compact ? title : undefined}
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
              <span className="block truncate text-sm font-medium text-zinc-800">{title}</span>
              <span className="block truncate text-[11px] text-zinc-400">{subtitle || email}</span>
            </span>
            <span className="shrink-0 text-zinc-300" aria-hidden>
              ›
            </span>
          </>
        )}
      </MenuButton>
      <MenuItems
        transition
        anchor="top start"
        className="z-50 w-72 origin-bottom rounded-2xl bg-white p-2 shadow-xl ring-1 ring-zinc-200 transition duration-200 ease-out [--anchor-gap:10px] focus:outline-none data-closed:scale-95 data-closed:opacity-0 dark:bg-zinc-900 dark:ring-zinc-700"
      >
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 px-2.5 py-2.5 dark:bg-white/8">
          {avatar}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{menuTitle}</p>
            <p className="truncate text-xs text-zinc-500">{email}</p>
          </div>
        </div>
        <div className="mt-2 space-y-1 px-2.5 py-1 text-xs text-zinc-500">
          {menuLines.map((line) => (
            <p key={line.label} className="truncate">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{line.label}</span> · {line.value}
            </p>
          ))}
        </div>
        <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-700" />
        <MenuItem>
          <button
            type="button"
            onClick={() => openUserProfile()}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-100 dark:data-focus:bg-white/10"
          >
            Manage account
          </button>
        </MenuItem>
        <MenuItem>
          <button
            type="button"
            onClick={() => void signOut()}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 data-focus:bg-zinc-100 dark:text-zinc-100 dark:data-focus:bg-white/10"
          >
            Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  )
}

import type { ComponentType, SVGProps } from 'react'
import {
  HomeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  Cog6ToothIcon,
  ChartBarSquareIcon,
  PhoneIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>

export type NavLink = {
  type: 'link'
  label: string
  href: string
  icon: HeroIcon
}

export type NavGroupChild = {
  label: string
  href: string
  icon?: HeroIcon
}

export type NavGroup = {
  type: 'group'
  label: string
  icon: HeroIcon
  children: NavGroupChild[]
}

export type NavItem = NavLink | NavGroup

export const mainNavItems: NavItem[] = [
  { type: 'link', label: 'Dashboard', href: '/', icon: HomeIcon },
  { type: 'link', label: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { type: 'link', label: 'Clients', href: '/clients', icon: UsersIcon },
  {
    type: 'group',
    label: 'Messages',
    icon: ChatBubbleLeftRightIcon,
    children: [{ label: 'Conversations', href: '/conversations', icon: ChatBubbleLeftRightIcon }],
  },
  {
    type: 'group',
    label: 'Calls',
    icon: PhoneIcon,
    children: [
      { label: 'Call stats', href: '/calls/stats', icon: ChartBarSquareIcon },
      { label: 'Calls', href: '/calls', icon: PhoneIcon },
    ],
  },
  { type: 'link', label: 'Accounts', href: '/accounts', icon: LinkIcon },
  { type: 'link', label: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

/** Match a nav href against the current path (avoids /calls lighting up on /calls/stats). */
export function isNavHrefCurrent(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/calls') {
    return (
      pathname === '/calls' ||
      (pathname.startsWith('/calls/') && !pathname.startsWith('/calls/stats'))
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isNavGroupCurrent(group: NavGroup, pathname: string): boolean {
  return group.children.some((child) => isNavHrefCurrent(child.href, pathname))
}

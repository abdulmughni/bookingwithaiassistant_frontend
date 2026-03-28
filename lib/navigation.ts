import {
  HomeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  Cog6ToothIcon,
  KeyIcon,
} from '@heroicons/react/20/solid'

export const mainNavItems = [
  { label: 'Dashboard', href: '/', icon: HomeIcon },
  { label: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { label: 'Conversations', href: '/conversations', icon: ChatBubbleLeftRightIcon },
  { label: 'Accounts', href: '/accounts', icon: LinkIcon },
  { label: 'Integrations', href: '/integrations', icon: KeyIcon },
  { label: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

import {
  HomeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  Cog6ToothIcon,
  ChartBarSquareIcon,
  PhoneIcon,
  MicrophoneIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

export const mainNavItems = [
  { label: 'Dashboard', href: '/', icon: HomeIcon },
  { label: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { label: 'Clients', href: '/clients', icon: UsersIcon },
  { label: 'Conversations', href: '/conversations', icon: ChatBubbleLeftRightIcon },
  { label: 'Call stats', href: '/calls/stats', icon: ChartBarSquareIcon },
  // { label: 'Calls', href: '/calls', icon: PhoneIcon },
  // { label: 'Voice setup', href: '/voice', icon: MicrophoneIcon },
  { label: 'Accounts', href: '/accounts', icon: LinkIcon },
  { label: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

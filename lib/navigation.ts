import {
  HomeIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  Cog6ToothIcon,
  KeyIcon,
  PhoneIcon,
  MicrophoneIcon,
} from '@heroicons/react/20/solid'

export const mainNavItems = [
  { label: 'Dashboard', href: '/', icon: HomeIcon },
  { label: 'Bookings', href: '/bookings', icon: CalendarDaysIcon },
  { label: 'Conversations', href: '/conversations', icon: ChatBubbleLeftRightIcon },
  { label: 'Calls', href: '/calls', icon: PhoneIcon },
  { label: 'Voice setup', href: '/voice', icon: MicrophoneIcon },
  { label: 'Accounts', href: '/accounts', icon: LinkIcon },
  { label: 'Integrations', href: '/integrations', icon: KeyIcon },
  { label: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

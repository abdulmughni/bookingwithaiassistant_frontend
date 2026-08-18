'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useRealtime } from '@/lib/realtime'
import type { Notification } from '@/lib/types'

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 minute ago'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return '1 hour ago'
  if (hrs < 24) return `${hrs} hours ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function typeMeta(type: string): { label: string; className: string } {
  switch (type) {
    case 'booking.created':
      return {
        label: 'New booking',
        className:
          'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
      }
    case 'booking.rescheduled':
      return {
        label: 'Rescheduled',
        className:
          'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
      }
    case 'booking.cancelled':
      return {
        label: 'Cancelled',
        className:
          'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
      }
    case 'emergency.reported':
      return {
        label: 'Emergency',
        className:
          'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/40',
      }
    default:
      return {
        label: 'Update',
        className:
          'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
      }
  }
}

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    clearAllNotifications,
  } = useRealtime()

  const handleOpen = (notif: Notification, close: () => void) => {
    void markRead(notif.id)
    close()
    if (notif.type === 'emergency.reported' && notif.conversation_id) {
      router.push(`/conversations?id=${encodeURIComponent(notif.conversation_id)}`)
    } else if (notif.booking_id) {
      router.push(`/bookings?booking=${encodeURIComponent(notif.booking_id)}`)
    } else if (notif.conversation_id) {
      router.push(`/conversations?id=${encodeURIComponent(notif.conversation_id)}`)
    } else {
      router.push('/bookings')
    }
  }

  return (
    <Headless.Popover className={clsx('relative', className)}>
      <Headless.PopoverButton
        className="relative flex size-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <BellIcon className="size-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4.5 text-white ring-2 ring-white dark:ring-zinc-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Headless.PopoverButton>

      <Headless.PopoverPanel
        transition
        anchor="bottom end"
        className={clsx(
          '[--anchor-gap:--spacing(2)] z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl',
          'bg-white shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10',
          'transition data-closed:opacity-0 data-closed:-translate-y-1 data-enter:duration-150 data-enter:ease-out data-leave:duration-100 data-leave:ease-in',
        )}
      >
        {({ close }) => (
          <div className="flex max-h-[70vh] flex-col">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Notifications
              </p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No notifications yet
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {notifications.map((notif) => {
                    const meta = typeMeta(notif.type)
                    return (
                      <li key={notif.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => handleOpen(notif, close)}
                          className={clsx(
                            'flex w-full items-start gap-3 px-4 py-3 pr-11 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                            !notif.is_read && 'bg-brand-50/50 dark:bg-brand-950/20',
                          )}
                        >
                          <span
                            className={clsx(
                              'mt-1.5 size-2 shrink-0 rounded-full',
                              notif.is_read ? 'bg-transparent' : 'bg-brand-500',
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="mb-1 flex items-center gap-2">
                              <span
                                className={clsx(
                                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
                                  meta.className,
                                )}
                              >
                                {meta.label}
                              </span>
                              <span className="ml-auto shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                                {timeAgo(notif.created_at)}
                              </span>
                            </span>
                            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">
                              {notif.title || 'Notification'}
                            </span>
                            {notif.body ? (
                              <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {notif.body}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label="Delete notification"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void removeNotification(notif.id)
                          }}
                          className={clsx(
                            'absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full',
                            'text-zinc-400 transition',
                            'opacity-0 group-hover:opacity-100 focus:opacity-100',
                            'hover:bg-zinc-100 hover:text-zinc-700',
                            'dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
                          )}
                        >
                          <XMarkIcon className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {notifications.length > 0 ? (
              <div className="sticky bottom-0 border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                <button
                  type="button"
                  onClick={() => void clearAllNotifications()}
                  className={clsx(
                    'flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold',
                    'bg-zinc-900 text-white shadow-sm transition',
                    'hover:bg-zinc-700',
                    'dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200',
                  )}
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Headless.PopoverPanel>
    </Headless.Popover>
  )
}

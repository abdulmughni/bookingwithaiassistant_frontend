'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline'

import { api } from '@/lib/api'
import { useApiToken } from '@/lib/hooks'
import type { AgencyNotification } from '@/lib/types'

function timeAgo(iso: string): string {
  const date = new Date(iso)
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function typeLabel(type: string): string {
  if (type === 'booking.created') return 'New booking'
  if (type === 'booking.rescheduled') return 'Rescheduled'
  if (type === 'booking.cancelled') return 'Cancelled'
  if (type === 'emergency.reported') return 'Emergency'
  return 'Update'
}

export function AgencyNotificationBell() {
  const router = useRouter()
  const getToken = useApiToken()
  const [items, setItems] = useState<AgencyNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const list = await api.admin.agencyNotifications(token)
      setItems(list.items)
      setUnreadCount(list.unread_count)
    } catch {
      /* Leave the last list on screen if a refresh fails. */
    }
  }, [getToken])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 60000)
    return () => window.clearInterval(timer)
  }, [load])

  async function openItem(item: AgencyNotification, close: () => void) {
    try {
      const token = await getToken()
      if (token && !item.is_read) await api.admin.agencyNotificationRead(token, item.id)
    } catch {
      /* Still open the client. */
    }
    close()
    router.push(`/admin/clients/${encodeURIComponent(item.tenant_id)}`)
    void load()
  }

  async function markAll() {
    const token = await getToken()
    if (!token) return
    await api.admin.agencyNotificationsReadAll(token)
    await load()
  }

  async function remove(id: string) {
    const token = await getToken()
    if (!token) return
    await api.admin.agencyNotificationRemove(token, id)
    await load()
  }

  async function clearAll() {
    const token = await getToken()
    if (!token) return
    await api.admin.agencyNotificationsClear(token)
    await load()
  }

  return (
    <Headless.Popover className="relative">
      <Headless.PopoverButton
        className="relative flex size-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <BellIcon className="size-6" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4.5 text-white ring-2 ring-white dark:ring-zinc-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
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
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAll()}
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-zinc-400">No notifications yet</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((item) => (
                    <li key={item.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => void openItem(item, close)}
                        className={clsx(
                          'flex w-full items-start gap-3 px-4 py-3 pr-11 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                          !item.is_read && 'bg-brand-50/50 dark:bg-brand-950/20',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="mb-1 flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              {typeLabel(item.type)}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-zinc-400">{timeAgo(item.created_at)}</span>
                          </span>
                          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">
                            {item.tenant_name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">
                            {item.title || item.body || 'Notification'}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete notification"
                        onClick={() => void remove(item.id)}
                        className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full text-zinc-400 opacity-0 hover:bg-zinc-100 group-hover:opacity-100 dark:hover:bg-zinc-800"
                      >
                        <XMarkIcon className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {items.length > 0 ? (
              <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => void clearAll()}
                  className="flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-950"
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

'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  FaceSmileIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  VideoCameraIcon,
  UserCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { useApiData, useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { Conversation, Message } from '@/lib/types'

function initials(name: string | null | undefined, fallback: string) {
  const s = (name || fallback).trim()
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  }
  return s.slice(0, 2).toUpperCase() || '?'
}

function avatarGradient(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return `linear-gradient(135deg, hsl(${hue}, 65%, 52%), hsl(${(hue + 40) % 360}, 70%, 45%))`
}

function formatListTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (d.toDateString() === now.toDateString()) {
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins} min`
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const yday = new Date(now)
  yday.setDate(yday.getDate() - 1)
  if (d.toDateString() === yday.toDateString()) {
    return 'Yesterday'
  }
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
}

function formatBubbleTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function dayLabel(d: Date) {
  const today = new Date()
  if (isSameDay(d, today)) return 'Today'
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  if (isSameDay(d, y)) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function MessageBubble({
  message,
  customerLabel,
  assistantLabel,
}: {
  message: Message
  customerLabel: string
  assistantLabel: string
}) {
  const isCustomer = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-zinc-200/80 px-3 py-1 text-center text-[11px] text-zinc-600 dark:bg-zinc-700/80 dark:text-zinc-300">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'group flex gap-2',
        isCustomer ? 'justify-start' : 'justify-end',
      )}
    >
      {isCustomer && (
        <div
          className="mt-1 size-8 shrink-0 rounded-full text-center text-[10px] font-bold leading-8 text-white shadow-sm"
          style={{ background: avatarGradient(customerLabel) }}
        >
          {initials(customerLabel, 'C')}
        </div>
      )}

      <div className={clsx('max-w-[min(100%,28rem)]', isCustomer ? 'order-0' : 'flex flex-row-reverse items-end gap-2')}>
        <div className="flex items-start gap-1">
          {!isCustomer && (
            <button
              type="button"
              className="mt-2 rounded p-0.5 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-600/50"
              aria-label="Message options"
            >
              <EllipsisVerticalIcon className="size-4" />
            </button>
          )}

          <div
            className={clsx(
              'relative px-4 py-2.5 text-sm shadow-sm',
              isCustomer
                ? 'rounded-2xl rounded-bl-md bg-linear-to-br from-violet-600 to-indigo-600 text-white'
                : 'rounded-2xl rounded-br-md bg-slate-200/90 text-slate-800 dark:bg-zinc-700 dark:text-zinc-100',
            )}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            <p
              className={clsx(
                'mt-1.5 flex items-center gap-1 text-[10px]',
                isCustomer ? 'text-violet-200' : 'text-slate-500 dark:text-zinc-400',
              )}
            >
              <ClockIcon className="size-3 shrink-0 opacity-80" aria-hidden />
              {formatBubbleTime(message.created_at)}
            </p>
          </div>

          {isCustomer && (
            <button
              type="button"
              className="mt-2 rounded p-0.5 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-600/50"
              aria-label="Message options"
            >
              <EllipsisVerticalIcon className="size-4" />
            </button>
          )}
        </div>

        <p
          className={clsx(
            'mt-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400',
            isCustomer ? 'text-left' : 'text-right',
          )}
        >
          {isCustomer ? customerLabel : assistantLabel}
        </p>
      </div>

      {!isCustomer && (
        <div
          className="mt-1 size-8 shrink-0 rounded-full text-center text-[10px] font-bold leading-8 text-white shadow-sm ring-2 ring-white dark:ring-zinc-900"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          AI
        </div>
      )}
    </div>
  )
}

function MessagesWithDividers({
  messages,
  customerLabel,
}: {
  messages: Message[]
  customerLabel: string
}) {
  const assistantLabel = 'Assistant'
  type Block = { type: 'divider'; label: string } | { type: 'msg'; message: Message }
  const blocks: Block[] = []

  let lastDay: Date | null = null
  for (const m of messages) {
    const d = new Date(m.created_at)
    if (!lastDay || !isSameDay(d, lastDay)) {
      blocks.push({ type: 'divider', label: dayLabel(d) })
      lastDay = d
    }
    blocks.push({ type: 'msg', message: m })
  }

  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'divider' ? (
          <div key={`d-${i}`} className="flex justify-center py-4">
            <span className="rounded-full bg-zinc-200/90 px-4 py-1 text-xs font-medium text-zinc-600 shadow-sm dark:bg-zinc-700/90 dark:text-zinc-300">
              {b.label}
            </span>
          </div>
        ) : (
          <MessageBubble
            key={b.message.id}
            message={b.message}
            customerLabel={customerLabel}
            assistantLabel={assistantLabel}
          />
        ),
      )}
    </>
  )
}

const channelBadgeStyles: Record<string, string> = {
  whatsapp: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  facebook: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  instagram: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  web: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
}

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const getToken = useApiToken()

  const { data: conversations, loading } = useApiData<Conversation[]>(
    (token) => api.conversations.list(token),
  )

  const filtered = useMemo(() => {
    if (!conversations) return []
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name = (c.customer_name || '').toLowerCase()
      const phone = (c.customer_phone || '').toLowerCase()
      const id = c.customer_id.toLowerCase()
      const intent = (c.intent || '').toLowerCase()
      return name.includes(q) || phone.includes(q) || id.includes(q) || intent.includes(q)
    })
  }, [conversations, query])

  const selected = conversations?.find((c) => c.id === selectedId)
  const displayName = selected?.customer_name || selected?.customer_phone || selected?.customer_id || 'Conversation'

  const loadMessages = async (convId: string) => {
    setSelectedId(convId)
    setMessagesLoading(true)
    try {
      const token = await getToken()
      const msgs = await api.conversations.messages(token, convId)
      setMessages(msgs)
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-zinc-50/80 dark:bg-zinc-950/50">
        {/* Sidebar */}
        <aside className="flex h-full min-h-0 w-full min-w-0 shrink-0 flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/80 md:w-[min(100%,20rem)] lg:w-[min(100%,22rem)]">
          <div className="border-b border-zinc-100 px-4 pb-3 pt-4 dark:border-zinc-800">
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Chats</h1>
            <div className="relative mt-3">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search messages or users"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border-0 bg-zinc-100 py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="px-4 pt-3">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Recent</h2>
          </div>

          <div className="mt-1 flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-18 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <ul className="space-y-0.5">
                {filtered.map((conv) => {
                  const active = selectedId === conv.id
                  const title = conv.customer_name || conv.customer_phone || conv.customer_id
                  const preview = conv.intent || conv.channel || 'Conversation'
                  const badgeClass = channelBadgeStyles[conv.channel] || channelBadgeStyles.web
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => loadMessages(conv.id)}
                        className={clsx(
                          'flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors',
                          active
                            ? 'bg-violet-100/90 dark:bg-violet-950/50'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80',
                        )}
                      >
                        <div className="relative shrink-0">
                          <div
                            className="flex size-11 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
                            style={{ background: avatarGradient(conv.id) }}
                          >
                            {initials(conv.customer_name, conv.customer_id)}
                          </div>
                          {conv.status === 'active' && (
                            <span
                              className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900"
                              title="Active"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate font-semibold text-zinc-900 dark:text-white">{title}</span>
                            <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                              {formatListTime(conv.updated_at)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{preview}</span>
                            <span
                              className={clsx(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                                badgeClass,
                              )}
                            >
                              {conv.channel}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-3 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {query ? 'No matching conversations' : 'No conversations yet'}
              </p>
            )}
          </div>
        </aside>

        {/* Main thread — column: fixed header + scrollable messages + fixed composer */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/30 dark:bg-zinc-950/30">
          {selectedId && selected ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="flex size-10 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                      style={{ background: avatarGradient(selected.id) }}
                    >
                      {initials(selected.customer_name, selected.customer_id)}
                    </div>
                    {selected.status === 'active' && (
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900 dark:text-white">{displayName}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                      {selected.channel} · {selected.status}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 text-zinc-500 dark:text-zinc-400">
                  <IconHeaderBtn label="Search">
                    <MagnifyingGlassIcon className="size-5" />
                  </IconHeaderBtn>
                  <IconHeaderBtn label="Call">
                    <PhoneIcon className="size-5" />
                  </IconHeaderBtn>
                  <IconHeaderBtn label="Video">
                    <VideoCameraIcon className="size-5" />
                  </IconHeaderBtn>
                  <IconHeaderBtn label="Profile">
                    <UserCircleIcon className="size-5" />
                  </IconHeaderBtn>
                  <IconHeaderBtn label="More">
                    <EllipsisVerticalIcon className="size-5" />
                  </IconHeaderBtn>
                </div>
              </header>

              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 md:px-8"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
              >
                {messagesLoading ? (
                  <div className="flex min-h-[12rem] items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                      <span className="text-sm text-zinc-500">Loading messages…</span>
                    </div>
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-1 pb-2">
                    <MessagesWithDividers
                      messages={messages}
                      customerLabel={selected.customer_name || 'Customer'}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[12rem] items-center justify-center py-12 text-sm text-zinc-500">
                    No messages in this conversation
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-zinc-200/80 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl bg-zinc-100/90 px-3 py-2 dark:bg-zinc-800/90">
                    <input
                      type="text"
                      readOnly
                      placeholder="Enter Message…"
                      className="min-h-11 min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-white"
                      aria-label="Message input (read-only)"
                    />
                    <div className="flex shrink-0 items-center gap-0.5 pb-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-200/80 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        aria-label="Emoji"
                      >
                        <FaceSmileIcon className="size-5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-200/80 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        aria-label="Attach file"
                      >
                        <PaperClipIcon className="size-5" />
                      </button>
                      <button
                        type="button"
                        disabled
                        className="ml-0.5 flex size-10 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 opacity-50"
                        aria-label="Send (coming soon)"
                      >
                        <PaperAirplaneIcon className="size-5 -rotate-45" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500"
                    aria-label="Settings"
                  >
                    <Cog6ToothIcon className="size-5" />
                  </button>
                </div>
              </footer>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div
                className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-100 to-indigo-100 text-violet-600 dark:from-violet-950 dark:to-indigo-950 dark:text-violet-300"
                aria-hidden
              >
                <MagnifyingGlassIcon className="size-8 opacity-80" />
              </div>
              <p className="max-w-sm text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Select a conversation to view messages
              </p>
              <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
                Choose a chat from the list on the left to see the full thread.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function IconHeaderBtn({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      className="rounded-lg p-2 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      aria-label={label}
    >
      {children}
    </button>
  )
}

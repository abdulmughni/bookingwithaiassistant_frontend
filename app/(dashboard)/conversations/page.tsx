'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  FaceSmileIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  VideoCameraIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import {
  ChatBubbleLeftRightIcon,
  PhotoIcon,
} from '@heroicons/react/24/solid'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { Conversation, Message, MessageAttachment } from '@/lib/types'

type ChannelTab = 'all' | 'facebook' | 'instagram' | 'whatsapp'

const CHANNEL_TABS: { id: ChannelTab; label: string }[] = [
  { id: 'all', label: 'All messages' },
  { id: 'facebook', label: 'Messenger' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

function channelTabLabel(channel: string): string {
  if (channel === 'facebook') return 'Messenger'
  if (channel === 'instagram') return 'Instagram'
  if (channel === 'whatsapp') return 'WhatsApp'
  return channel
}

/** WhatsApp `customer_id` is the wa_id (digits); show as a phone when API omits customer_phone. */
function displayFromWhatsAppCustomerId(customerId: string): string | null {
  const d = customerId.replace(/\D/g, '')
  if (d.length < 10 || d.length > 15) return null
  return `+${d}`
}

/**
 * List + thread title using only fields present on the conversation API object.
 * When name columns are null, we still show something human-readable (phone from wa_id, inbox label).
 */
function conversationDisplayName(c: Conversation): string {
  // WhatsApp: profile name from webhook `contacts[].profile.name` is exposed as customer_display_name.
  if (c.channel === 'whatsapp') {
    const waProfile = c.customer_display_name?.trim()
    if (waProfile) return waProfile
    const waResolved = c.customer_name?.trim()
    if (waResolved) return waResolved
    const waPhone = c.customer_phone?.trim()
    if (waPhone) return waPhone
    const fromId = displayFromWhatsAppCustomerId(c.customer_id)
    if (fromId) return fromId
    return 'WhatsApp contact'
  }

  const resolved = c.customer_name?.trim()
  if (resolved) return resolved
  const labelName = c.customer_label_name?.trim()
  if (labelName) return labelName
  const display = c.customer_display_name?.trim()
  if (display) return display
  const phone = c.customer_phone?.trim()
  if (phone) return phone

  const inboxLabel = c.channel_account_label?.trim()
  if (inboxLabel && (c.channel === 'facebook' || c.channel === 'instagram')) {
    return inboxLabel
  }

  const idDigits = c.customer_id.replace(/\D/g, '')
  if (
    (c.channel === 'facebook' || c.channel === 'instagram') &&
    idDigits.length >= 8
  ) {
    return `${channelTabLabel(c.channel)} ····${idDigits.slice(-4)}`
  }

  if (c.channel === 'facebook') return 'Messenger contact'
  if (c.channel === 'instagram') return 'Instagram contact'
  return 'Guest'
}

function nameForAvatarFallback(c: Conversation): string | null {
  if (c.channel === 'whatsapp') {
    const profile = c.customer_display_name?.trim()
    if (profile) return profile
  }
  const title = conversationDisplayName(c)
  const placeholders = new Set([
    'Guest',
    'Messenger contact',
    'Instagram contact',
    'WhatsApp contact',
  ])
  if (placeholders.has(title)) return null
  if (/^(Messenger|Instagram) ····\d{4}$/.test(title)) return null
  if (/^\+\d{10,16}$/.test(title)) return title.slice(-2)
  return title
}

function listPreviewLine(c: Conversation): string {
  const raw = c.last_message_preview?.trim()
  if (raw) {
    const max = 80
    const snippet = raw.length > max ? `${raw.slice(0, max)}…` : raw
    const role = c.last_message_role
    if (role === 'assistant' || role === 'tool') return `You: ${snippet}`
    return snippet
  }
  if (c.channel_account_label) return `Chat on ${c.channel_account_label}`
  return `New thread · ${channelTabLabel(c.channel)}`
}

function listTimeIso(c: Conversation): string {
  return c.last_message_at || c.updated_at
}

function ConversationAvatar({
  imageUrl,
  nameFallback,
  idFallback,
  seed,
  sizeClass = 'size-14',
  children,
}: {
  imageUrl?: string | null
  nameFallback?: string | null
  idFallback: string
  seed: string
  sizeClass?: string
  children?: React.ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const showImg = Boolean(imageUrl) && !broken
  return (
    <div className={clsx('relative shrink-0', sizeClass)}>
      <div className="relative size-full overflow-hidden rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element -- Meta CDN URLs
          <img
            src={imageUrl as string}
            alt=""
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className="flex size-full items-center justify-center text-sm font-bold text-white"
            style={{ background: avatarGradient(seed) }}
          >
            {initials(nameFallback, idFallback)}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function ChannelBadgeOverlay({ channel }: { channel: string }) {
  const common =
    'pointer-events-none absolute bottom-0 right-0 flex size-[22px] translate-x-0.5 translate-y-0.5 items-center justify-center rounded-full border-[2.5px] border-white text-white shadow-sm dark:border-zinc-900'
  if (channel === 'facebook') {
    return (
      <span className={clsx(common, 'bg-[#0084FF]')} title="Messenger">
        <ChatBubbleLeftRightIcon className="size-3" aria-hidden />
      </span>
    )
  }
  if (channel === 'instagram') {
    return (
      <span
        className={clsx(
          common,
          'bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]',
        )}
        title="Instagram"
      >
        <PhotoIcon className="size-3" aria-hidden />
      </span>
    )
  }
  if (channel === 'whatsapp') {
    return (
      <span className={clsx(common, 'bg-[#25D366]')} title="WhatsApp">
        <span className="text-[10px] font-bold leading-none">W</span>
      </span>
    )
  }
  return (
    <span className={clsx(common, 'bg-zinc-500')} title={channel}>
      <ChatBubbleLeftRightIcon className="size-3 opacity-90" aria-hidden />
    </span>
  )
}

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
    if (mins < 60) return `${mins}m`
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const yday = new Date(now)
  yday.setDate(yday.getDate() - 1)
  if (d.toDateString() === yday.toDateString()) {
    return 'Yesterday'
  }
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
}

function formatBubbleTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** When we persisted Messenger/IG photos, ``content`` duplicates captions; prefer the typed line. */
function bubbleTextForDisplay(message: Message): string {
  const raw = message.content.trim()
  const hasInlineMedia = (message.attachments ?? []).some((a) => Boolean(a.delivery_url))
  if (!hasInlineMedia || message.role !== 'user') return raw

  const marker = /\n*\[Customer's text]\s*\n/i
  const match = raw.match(marker)
  if (match && match.index !== undefined) {
    const after = raw.slice(match.index + match[0].length).trim()
    if (after.length > 0) return after
  }
  // Photo/audio-only turn: synthesized body is attachment captions — hide when cards render them.
  if (/^\[Attachment\b/i.test(raw)) {
    return ''
  }
  return raw
}

function MessageAttachmentsStack({
  attachments,
  alignOutgoing,
}: {
  attachments: MessageAttachment[]
  alignOutgoing: boolean
}) {
  const playable = attachments.filter((a) => Boolean(a.delivery_url))
  if (playable.length === 0) return null

  return (
    <div
      className={clsx(
        'mb-2 flex flex-col gap-2',
        alignOutgoing ? 'items-end' : 'items-start',
      )}
    >
      {playable.map((a) => (
        <div key={a.id} className="max-w-full">
          {a.kind === 'image' && (
            <div className="overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/15">
              <a href={a.delivery_url!} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary signed URL */}
                <img
                  src={a.delivery_url!}
                  alt=""
                  className="max-h-72 w-auto max-w-[min(100%,18rem)] object-cover sm:max-w-[20rem]"
                  loading="lazy"
                />
              </a>
              {a.ai_caption ? (
                <p className="border-t border-black/5 bg-black/[0.03] px-2 py-1.5 text-[11px] leading-snug text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
                  {a.ai_caption}
                </p>
              ) : null}
            </div>
          )}

          {a.kind === 'audio' && (
            <div
              className={clsx(
                'min-w-[12rem] max-w-[min(100%,20rem)] rounded-2xl px-3 py-2 ring-1 ring-black/10 dark:ring-white/15',
                alignOutgoing ? 'bg-[#0084ff]/15 dark:bg-sky-900/40' : 'bg-black/[0.06] dark:bg-white/[0.08]',
              )}
            >
              <audio
                controls
                src={a.delivery_url!}
                className="h-9 w-full max-w-full"
                preload="metadata"
              >
                Your browser does not support audio.
              </audio>
              {a.ai_transcript ? (
                <p className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-zinc-600 dark:text-zinc-300">
                  {a.ai_transcript}
                </p>
              ) : null}
            </div>
          )}

          {a.kind !== 'image' && a.kind !== 'audio' && (
            <a
              href={a.delivery_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-black/[0.06] px-3 py-2 text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:bg-white/[0.08] dark:text-zinc-200"
            >
              Open attachment ({a.kind})
            </a>
          )}
        </div>
      ))}
    </div>
  )
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
  customerName,
  customerAvatarUrl,
  customerSeed,
  channel,
}: {
  message: Message
  customerName: string
  customerAvatarUrl?: string | null
  customerSeed: string
  channel: string
}) {
  const isCustomer = message.role === 'user'
  const isSystem = message.role === 'system'
  const metaAttachments = message.attachments ?? []
  const showMessengerMedia =
    isCustomer &&
    (channel === 'facebook' || channel === 'instagram') &&
    metaAttachments.some((a) => Boolean(a.delivery_url))
  const bubbleBody = bubbleTextForDisplay(message)

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-zinc-200/90 px-3 py-1 text-center text-[11px] text-zinc-600 dark:bg-zinc-700/90 dark:text-zinc-300">
          {message.content}
        </span>
      </div>
    )
  }

  const isOutgoing = !isCustomer

  return (
    <div
      className={clsx(
        'group flex gap-2 py-0.5',
        isCustomer ? 'justify-start' : 'justify-end',
      )}
    >
      {isCustomer && (
        <div className="mt-auto shrink-0 pb-1">
          <div className="size-7 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
            {customerAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customerAvatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div
                className="flex size-full items-center justify-center text-[9px] font-bold text-white"
                style={{ background: avatarGradient(customerSeed) }}
              >
                {initials(customerName, 'C')}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={clsx(
          'max-w-[min(100%,26rem)]',
          isOutgoing && 'flex flex-row-reverse items-end gap-2',
        )}
      >
        <div className="flex items-end gap-1">
          <div
            className={clsx(
              'relative px-3 py-2 text-[15px] leading-snug shadow-sm',
              isCustomer
                ? 'rounded-[18px] rounded-bl-md bg-[#e4e6eb] text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                : 'rounded-[18px] rounded-br-md bg-[#0084ff] text-white',
            )}
          >
            {showMessengerMedia ? (
              <MessageAttachmentsStack
                attachments={metaAttachments}
                alignOutgoing={isOutgoing}
              />
            ) : null}
            <p className="whitespace-pre-wrap">{bubbleBody}</p>
            <p
              className={clsx(
                'mt-1 text-[11px]',
                isCustomer ? 'text-zinc-500 dark:text-zinc-400' : 'text-white/80',
              )}
            >
              {formatBubbleTime(message.created_at)}
            </p>
          </div>

          {isOutgoing && (
            <div className="mb-1 size-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-zinc-900">
              <div
                className="flex size-full items-center justify-center text-[9px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
              >
                AI
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessagesWithDividers({
  messages,
  customerName,
  customerAvatarUrl,
  customerSeed,
  channel,
}: {
  messages: Message[]
  customerName: string
  customerAvatarUrl?: string | null
  customerSeed: string
  channel: string
}) {
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
          <div key={`d-${i}`} className="flex justify-center py-3">
            <span className="text-xs font-medium text-zinc-400">{b.label}</span>
          </div>
        ) : (
          <MessageBubble
            key={b.message.id}
            message={b.message}
            customerName={customerName}
            customerAvatarUrl={customerAvatarUrl}
            customerSeed={customerSeed}
            channel={channel}
          />
        ),
      )}
    </>
  )
}

export default function ConversationsPage() {
  const CONVERSATIONS_PAGE_SIZE = 60
  const MESSAGES_PAGE_SIZE = 80

  const getToken = useApiToken()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationsLoadingMore, setConversationsLoadingMore] = useState(false)
  const [conversationsHasMore, setConversationsHasMore] = useState(true)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [channelTab, setChannelTab] = useState<ChannelTab>('all')
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false)
  const [messagesHasMore, setMessagesHasMore] = useState(false)
  const [messagesOffset, setMessagesOffset] = useState(0)

  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const listSentinelRef = useRef<HTMLDivElement | null>(null)
  /** Pagination cursor for "load more" — must NOT live in useCallback deps or every
   *  successful page recreates the callback and retriggers the tab/search effect. */
  const conversationsOffsetRef = useRef(0)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320)
    return () => clearTimeout(t)
  }, [query])

  const fetchConversations = useCallback(
    async (opts?: { reset?: boolean }) => {
      const reset = Boolean(opts?.reset)
      if (reset) {
        setConversationsLoading(true)
        setConversationsLoadingMore(false)
        conversationsOffsetRef.current = 0
      } else {
        setConversationsLoadingMore(true)
      }
      try {
        const token = await getToken()
        const offset = reset ? 0 : conversationsOffsetRef.current
        const page = await api.conversations.listPaged(token, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset,
          channel: channelTab === 'all' ? undefined : channelTab,
          q: debouncedQuery || undefined,
        })
        setConversations((prev) => {
          if (reset) return page.items
          const existing = new Set(prev.map((c) => c.id))
          const merged = [...prev]
          for (const item of page.items) {
            if (!existing.has(item.id)) merged.push(item)
          }
          return merged
        })
        setConversationsHasMore(page.has_more)
        const nextOffset = page.next_offset ?? offset + page.items.length
        conversationsOffsetRef.current = nextOffset
      } finally {
        setConversationsLoading(false)
        setConversationsLoadingMore(false)
      }
    },
    [channelTab, debouncedQuery, getToken],
  )

  useEffect(() => {
    conversationsOffsetRef.current = 0
    setConversations([])
    setConversationsHasMore(true)
    void fetchConversations({ reset: true })
  }, [channelTab, debouncedQuery, fetchConversations])

  const filtered = conversations

  const listVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 84,
    overscan: 10,
  })
  const virtualRows = listVirtualizer.getVirtualItems()

  // Load older pages when the user scrolls the inbox near the bottom. We use
  // IntersectionObserver instead of depending on virtualRows (new array every
  // measure) which was firing the effect constantly and spamming the API.
  useEffect(() => {
    const root = listScrollRef.current
    const sentinel = listSentinelRef.current
    if (!root || !sentinel) return

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (!hit) return
        if (!conversationsHasMore || conversationsLoading || conversationsLoadingMore) return
        void fetchConversations()
      },
      { root, rootMargin: '120px', threshold: 0 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [
    conversationsHasMore,
    conversationsLoading,
    conversationsLoadingMore,
    fetchConversations,
    filtered.length,
  ])

  const selected = conversations.find((c) => c.id === selectedId)
  const displayName = selected ? conversationDisplayName(selected) : 'Conversation'
  const customerThreadName = selected ? conversationDisplayName(selected) : 'Customer'

  const loadMessages = async (convId: string) => {
    setSelectedId(convId)
    setMessagesLoading(true)
    setMessages([])
    setMessagesOffset(0)
    setMessagesHasMore(false)
    try {
      const token = await getToken()
      const page = await api.conversations.messagesPaged(token, convId, {
        limit: MESSAGES_PAGE_SIZE,
        offset: 0,
        order: 'desc',
      })
      // API returns newest-first for lazy paging; UI renders oldest->newest.
      setMessages([...page.items].reverse())
      setMessagesOffset(page.next_offset ?? page.items.length)
      setMessagesHasMore(page.has_more)
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
      // After initial load, snap to bottom like messaging apps.
      setTimeout(() => {
        const box = threadScrollRef.current
        if (box) box.scrollTop = box.scrollHeight
      }, 0)
    }
  }

  const loadOlderMessages = useCallback(async () => {
    if (!selectedId || messagesLoading || messagesLoadingMore || !messagesHasMore) return
    const box = threadScrollRef.current
    const oldHeight = box?.scrollHeight ?? 0
    setMessagesLoadingMore(true)
    try {
      const token = await getToken()
      const page = await api.conversations.messagesPaged(token, selectedId, {
        limit: MESSAGES_PAGE_SIZE,
        offset: messagesOffset,
        order: 'desc',
      })
      const olderChunk = [...page.items].reverse()
      setMessages((prev) => [...olderChunk, ...prev])
      setMessagesOffset(page.next_offset ?? messagesOffset + page.items.length)
      setMessagesHasMore(page.has_more)

      // Preserve viewport anchor after prepending older messages.
      setTimeout(() => {
        const cur = threadScrollRef.current
        if (!cur) return
        const newHeight = cur.scrollHeight
        cur.scrollTop = newHeight - oldHeight + cur.scrollTop
      }, 0)
    } finally {
      setMessagesLoadingMore(false)
    }
  }, [
    getToken,
    messagesHasMore,
    messagesLoading,
    messagesLoadingMore,
    messagesOffset,
    selectedId,
  ])

  const refreshList = async () => {
    conversationsOffsetRef.current = 0
    setConversationsHasMore(true)
    await fetchConversations({ reset: true })
    if (selectedId) void loadMessages(selectedId)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Channel tabs — Meta Business Suite style */}
      <div className="shrink-0 border-b border-zinc-200 bg-white px-2 pt-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex min-h-11 items-stretch gap-1 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHANNEL_TABS.map((tab) => {
            const active = channelTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChannelTab(tab.id)}
                className={clsx(
                  'shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-zinc-100/80 dark:bg-zinc-950">
        {/* Sidebar inbox */}
        <aside className="flex h-full min-h-0 w-full min-w-0 shrink-0 flex-col border-r border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:w-[min(100%,22rem)] lg:w-[min(100%,24rem)]">
          <div className="border-b border-zinc-100 px-3 pb-3 pt-3 dark:border-zinc-800">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder="Search conversations"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => void refreshList()}
                disabled={conversationsLoading}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                aria-label="Refresh conversation list"
                title="Refresh list"
              >
                <ArrowPathIcon className={clsx('size-5', conversationsLoading && 'animate-spin')} />
              </button>
            </div>
          </div>

          <div ref={listScrollRef} className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <>
                <div
                  className="relative py-1"
                  style={{ height: `${listVirtualizer.getTotalSize()}px` }}
                >
                  {virtualRows.map((vr) => {
                    const conv = filtered[vr.index]
                    if (!conv) return null
                    const active = selectedId === conv.id
                    const title = conversationDisplayName(conv)
                    const preview = listPreviewLine(conv)
                    const tIso = listTimeIso(conv)
                    return (
                      <div
                        key={conv.id}
                        className="absolute left-0 top-0 w-full"
                        style={{ transform: `translateY(${vr.start}px)` }}
                      >
                        <button
                          type="button"
                          onClick={() => loadMessages(conv.id)}
                          className={clsx(
                            'relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                            active
                              ? 'bg-zinc-100 dark:bg-zinc-800/90'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                          )}
                        >
                          {active && (
                            <span
                              className="absolute right-0 top-0 h-full w-1 bg-[#0084ff]"
                              aria-hidden
                            />
                          )}
                          <ConversationAvatar
                            imageUrl={conv.customer_avatar_url}
                            nameFallback={nameForAvatarFallback(conv)}
                            idFallback="?"
                            seed={conv.id}
                            sizeClass="size-14"
                          >
                            <ChannelBadgeOverlay channel={conv.channel} />
                          </ConversationAvatar>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate font-semibold text-zinc-900 dark:text-white">
                                {title}
                              </span>
                              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                                {formatListTime(tIso)}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                              {preview}
                            </p>
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="px-3 py-3">
                  {conversationsLoadingMore ? (
                    <div className="h-9 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
                  ) : conversationsHasMore ? (
                    <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                      Loading as you scroll…
                    </p>
                  ) : (
                    <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">End of list</p>
                  )}
                </div>
                {/* Triggers one "load more" when scrolled into view — avoids virtualRows effect spam */}
                <div ref={listSentinelRef} className="h-1 w-full shrink-0" aria-hidden />
              </>
            ) : (
              <p className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {query || channelTab !== 'all'
                  ? 'No matching conversations'
                  : 'No conversations yet'}
              </p>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-zinc-900">
          {selectedId && selected ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="flex min-w-0 items-center gap-3">
                  <ConversationAvatar
                    imageUrl={selected.customer_avatar_url}
                    nameFallback={nameForAvatarFallback(selected)}
                    idFallback="?"
                    seed={selected.id}
                    sizeClass="size-11"
                  >
                    <ChannelBadgeOverlay channel={selected.channel} />
                  </ConversationAvatar>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-zinc-900 dark:text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {[selected.customer_phone, selected.channel_account_label]
                        .filter(Boolean)
                        .join(' · ')}
                      {selected.customer_phone || selected.channel_account_label ? ' · ' : ''}
                      <span className="capitalize">{channelTabLabel(selected.channel)}</span>
                      {selected.status === 'active' && (
                        <>
                          {' '}
                          · <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                        </>
                      )}
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
                ref={threadScrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#f0f2f5] px-3 py-4 dark:bg-zinc-950 md:px-6"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.scrollTop < 72) void loadOlderMessages()
                }}
              >
                {!messagesLoading && messagesHasMore && (
                  <div className="mx-auto mb-3 max-w-3xl text-center">
                    {messagesLoadingMore ? (
                      <span className="rounded-full bg-zinc-200/90 px-3 py-1 text-[11px] text-zinc-600 dark:bg-zinc-700/90 dark:text-zinc-300">
                        Loading older messages…
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void loadOlderMessages()}
                        className="rounded-full bg-zinc-200/90 px-3 py-1 text-[11px] text-zinc-600 transition hover:bg-zinc-300 dark:bg-zinc-700/90 dark:text-zinc-300 dark:hover:bg-zinc-600"
                      >
                        Load older messages
                      </button>
                    )}
                  </div>
                )}
                {messagesLoading ? (
                  <div className="flex min-h-48 items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                      <span className="text-sm text-zinc-500">Loading messages…</span>
                    </div>
                  </div>
                ) : messages.length > 0 ? (
                  <div className="mx-auto max-w-3xl space-y-0.5 pb-2">
                    <MessagesWithDividers
                      messages={messages}
                      customerName={customerThreadName}
                      customerAvatarUrl={selected.customer_avatar_url}
                      customerSeed={selected.id}
                      channel={selected.channel}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-48 items-center justify-center py-12 text-sm text-zinc-500">
                    No messages in this conversation
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mx-auto flex max-w-3xl items-end gap-2">
                  <div className="flex min-w-0 flex-1 items-end gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
                    <input
                      type="text"
                      readOnly
                      placeholder="Aa"
                      className="min-h-10 min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-white"
                      aria-label="Message input (read-only)"
                    />
                    <div className="flex shrink-0 items-center gap-0.5 pb-1">
                      <button
                        type="button"
                        className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200/80 dark:hover:bg-zinc-700"
                        aria-label="Emoji"
                      >
                        <FaceSmileIcon className="size-5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200/80 dark:hover:bg-zinc-700"
                        aria-label="Attach file"
                      >
                        <PaperClipIcon className="size-5" />
                      </button>
                      <button
                        type="button"
                        disabled
                        className="ml-1 flex size-9 items-center justify-center rounded-full bg-[#0084ff] text-white opacity-50 shadow-sm"
                        aria-label="Send (coming soon)"
                      >
                        <PaperAirplaneIcon className="size-4 -rotate-45" />
                      </button>
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#f0f2f5] p-8 text-center dark:bg-zinc-950">
              <div
                className="flex size-16 items-center justify-center rounded-full bg-white text-sky-500 shadow-sm dark:bg-zinc-800"
                aria-hidden
              >
                <ChatBubbleLeftRightIcon className="size-8" />
              </div>
              <p className="max-w-sm text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Select a conversation
              </p>
              <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
                Choose a chat from the inbox. Filter by Messenger, Instagram, or WhatsApp using the
                tabs above.
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
      className="rounded-full p-2 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      aria-label={label}
    >
      {children}
    </button>
  )
}

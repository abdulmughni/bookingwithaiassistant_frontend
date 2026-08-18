'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@/lib/api'
import { useApiToken } from '@/lib/hooks'
import type { Notification, RealtimeEvent } from '@/lib/types'

// ---------------------------------------------------------------------------
// WS base URL: derive from the API base (http->ws) unless overridden.
// ---------------------------------------------------------------------------
function resolveWsBase(): string {
  const override = process.env.NEXT_PUBLIC_WS_BASE_URL
  if (override && override.trim()) return override.trim().replace(/\/$/, '')
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
  return apiBase.trim().replace(/\/$/, '').replace(/^http/i, 'ws')
}

type EventHandler = (event: RealtimeEvent) => void

interface RealtimeContextValue {
  connected: boolean
  notifications: Notification[]
  unreadCount: number
  subscribe: (handler: EventHandler) => () => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  removeNotification: (id: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

const MAX_BACKOFF_MS = 30_000
const BASE_BACKOFF_MS = 1_000

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { orgId, isSignedIn } = useAuth()
  const getToken = useApiToken()

  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const handlersRef = useRef<Set<EventHandler>>(new Set())
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const closedByUsRef = useRef(false)

  const subscribe = useCallback((handler: EventHandler) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  const refreshNotifications = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.notifications.list(token, { limit: 50 })
      setNotifications(res.items)
      setUnreadCount(res.unread_count)
    } catch {
      // Non-fatal: bell just stays empty until the next attempt.
    }
  }, [getToken])

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      try {
        const token = await getToken()
        if (token) await api.notifications.markRead(token, id)
      } catch {
        void refreshNotifications()
      }
    },
    [getToken, refreshNotifications],
  )

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    try {
      const token = await getToken()
      if (token) await api.notifications.markAllRead(token)
    } catch {
      void refreshNotifications()
    }
  }, [getToken, refreshNotifications])

  const removeNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id)
        const unread = next.filter((n) => !n.is_read).length
        setUnreadCount(unread)
        return next
      })
      try {
        const token = await getToken()
        if (token) await api.notifications.remove(token, id)
      } catch {
        void refreshNotifications()
      }
    },
    [getToken, refreshNotifications],
  )

  const clearAllNotifications = useCallback(async () => {
    setNotifications([])
    setUnreadCount(0)
    try {
      const token = await getToken()
      if (token) await api.notifications.clearAll(token)
    } catch {
      void refreshNotifications()
    }
  }, [getToken, refreshNotifications])

  // Handle events the provider owns (bell). Others are fanned out to subscribers.
  const handleEvent = useCallback((event: RealtimeEvent) => {
    if (event.type === 'connected' || event.type === 'ping') return

    if (
      (event.type === 'booking.created' ||
        event.type === 'booking.rescheduled' ||
        event.type === 'booking.cancelled' ||
        event.type === 'emergency.reported') &&
      event.notification
    ) {
      const notif = event.notification
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev
        return [notif, ...prev].slice(0, 100)
      })
      if (!notif.is_read) setUnreadCount((prev) => prev + 1)
    }

    handlersRef.current.forEach((handler) => {
      try {
        handler(event)
      } catch {
        // A misbehaving subscriber must not break fan-out to others.
      }
    })
  }, [])

  // Connection lifecycle: connect while signed in with an org; reconnect with backoff.
  useEffect(() => {
    if (!isSignedIn || !orgId) return

    let disposed = false
    closedByUsRef.current = false

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (disposed) return
      const attempt = attemptRef.current
      const delay = Math.min(
        MAX_BACKOFF_MS,
        BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 500,
      )
      attemptRef.current = attempt + 1
      clearReconnect()
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    const connect = async () => {
      if (disposed) return
      let token = ''
      try {
        token = await getToken()
      } catch {
        scheduleReconnect()
        return
      }
      if (disposed || !token) {
        if (!disposed) scheduleReconnect()
        return
      }

      const url = `${resolveWsBase()}/api/ws?token=${encodeURIComponent(token)}`
      let ws: WebSocket
      try {
        ws = new WebSocket(url)
      } catch {
        scheduleReconnect()
        return
      }
      socketRef.current = ws

      ws.onopen = () => {
        if (disposed) {
          ws.close()
          return
        }
        attemptRef.current = 0
        setConnected(true)
      }

      ws.onmessage = (raw) => {
        try {
          const event = JSON.parse(raw.data) as RealtimeEvent
          handleEvent(event)
        } catch {
          // Ignore non-JSON frames.
        }
      }

      ws.onclose = () => {
        setConnected(false)
        socketRef.current = null
        if (!disposed && !closedByUsRef.current) scheduleReconnect()
      }

      ws.onerror = () => {
        // onclose fires after onerror; reconnect is handled there.
        try {
          ws.close()
        } catch {
          /* no-op */
        }
      }
    }

    // Seed the bell, then open the socket.
    void refreshNotifications()
    void connect()

    return () => {
      disposed = true
      closedByUsRef.current = true
      clearReconnect()
      const ws = socketRef.current
      socketRef.current = null
      if (ws) {
        try {
          ws.close()
        } catch {
          /* no-op */
        }
      }
      setConnected(false)
    }
    // Reconnect from scratch when the signed-in org changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, orgId])

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      notifications,
      unreadCount,
      subscribe,
      markRead,
      markAllRead,
      removeNotification,
      clearAllNotifications,
      refreshNotifications,
    }),
    [
      connected,
      notifications,
      unreadCount,
      subscribe,
      markRead,
      markAllRead,
      removeNotification,
      clearAllNotifications,
      refreshNotifications,
    ],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return ctx
}

/** Subscribe to realtime events with automatic cleanup. */
export function useRealtimeEvent(handler: EventHandler) {
  const { subscribe } = useRealtime()
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    return subscribe((event) => handlerRef.current(event))
  }, [subscribe])
}

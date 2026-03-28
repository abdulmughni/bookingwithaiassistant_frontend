'use client'

import { useState } from 'react'
import { Heading, Subheading } from '@/components/heading'
import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { useApiData, useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import {
  formatRelativeTime,
  statusColor,
  channelColor,
} from '@/lib/utils'
import type { Conversation, Message } from '@/lib/types'

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
            : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={`mt-1 text-[10px] ${
            isUser
              ? 'text-zinc-400 dark:text-zinc-500'
              : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          {formatRelativeTime(message.created_at)}
        </p>
      </div>
    </div>
  )
}

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const getToken = useApiToken()

  const { data: conversations, loading } = useApiData<Conversation[]>(
    (token) => api.conversations.list(token),
  )

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
    <>
      <Heading>Conversations</Heading>
      <Divider className="mt-6" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: conversation list */}
        <div className="lg:col-span-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : conversations && conversations.length > 0 ? (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
                    selectedId === conv.id
                      ? 'bg-zinc-100 dark:bg-zinc-800'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-950 dark:text-white">
                      {conv.customer_name || conv.customer_id}
                    </span>
                    <Badge color={channelColor(conv.channel)}>
                      {conv.channel}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {conv.intent || 'No intent'}
                    </span>
                    <Badge color={statusColor(conv.status)}>
                      {conv.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-400">
                    {formatRelativeTime(conv.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <Text className="py-8 text-center">No conversations yet</Text>
          )}
        </div>

        {/* Right: message thread */}
        <div className="lg:col-span-2">
          {selectedId ? (
            <div className="flex h-[600px] flex-col rounded-lg border border-zinc-950/5 dark:border-white/5">
              <div className="border-b border-zinc-950/5 px-4 py-3 dark:border-white/5">
                <Subheading>
                  {conversations?.find((c) => c.id === selectedId)
                    ?.customer_name || 'Conversation'}
                </Subheading>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Text>Loading messages...</Text>
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Text>No messages in this conversation</Text>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-[600px] items-center justify-center rounded-lg border border-dashed border-zinc-950/10 dark:border-white/10">
              <Text>Select a conversation to view messages</Text>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  EnvelopeIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { Dialog, DialogTitle } from '@/components/dialog'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { SourceBadge } from '@/components/channel-icon'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Customer, CustomerDetail } from '@/lib/types'

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PhoneIcon
  label: string
  value: string
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 ring-1 ring-zinc-950/5 dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-white/5">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-0.5 wrap-break-word text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {value}
        </p>
      </div>
    </div>
  )
}

export function ClientDetailsDialog({
  open,
  clientId,
  onClose,
  onEdit,
}: {
  open: boolean
  clientId: string | null
  onClose: () => void
  onEdit?: (client: Customer) => void
}) {
  const getToken = useApiToken()
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const id = (clientId || '').trim()
    if (!id) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const token = await getToken()
      const row = await api.customers.get(token, id)
      setData(row)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [getToken, clientId])

  useEffect(() => {
    if (!open || !clientId) {
      setData(null)
      return
    }
    void load()
  }, [open, clientId, load])

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <DialogTitle className="text-lg font-semibold text-zinc-950 dark:text-white">
            {loading && !data ? 'Loading client…' : data?.display_name || 'Client'}
          </DialogTitle>
          {data ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Last seen {data.last_seen_at ? formatDate(data.last_seen_at) : '—'}
              {' · '}
              Updated {formatDate(data.updated_at)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {data?.jobber_client_id ? <Badge color="lime">Jobber</Badge> : null}
          {data ? (
            <Badge color="zinc">
              {data.bookings_count} booking{data.bookings_count === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-6 space-y-3">
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ) : !data ? (
        <p className="mt-6 text-sm text-zinc-500">Client not found.</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-white/10 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Contact</h2>
              {onEdit ? (
                <Button
                  plain
                  className="text-xs"
                  onClick={() => {
                    onEdit(data)
                  }}
                >
                  <PencilSquareIcon data-slot="icon" className="size-4" />
                  Edit
                </Button>
              ) : null}
            </div>
            <DetailRow
              icon={UserCircleIcon}
              label="Name"
              value={data.display_name || '—'}
            />
            <DetailRow icon={PhoneIcon} label="Phone" value={data.phone || '—'} />
            <DetailRow icon={EnvelopeIcon} label="Email" value={data.email || '—'} />
            <DetailRow
              icon={MapPinIcon}
              label="Address"
              value={data.primary_address || '—'}
            />
            {data.notes ? (
              <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                  {data.notes}
                </p>
              </div>
            ) : null}
          </section>

          <div className="space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Channels</h2>
              {data.channel_identities.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No linked channel identities yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.channel_identities.map((id) => (
                    <li
                      key={`${id.channel}-${id.external_id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <SourceBadge channel={id.channel} />
                      <span className="truncate text-zinc-500">{id.external_id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Booking history</h2>
              {data.bookings.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No bookings yet.</p>
              ) : (
                <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">
                  {data.bookings.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-zinc-900 dark:text-white">{b.service_type}</p>
                        <Badge color="zinc">{b.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {b.selected_slot ? formatDateTime(b.selected_slot) : formatDate(b.created_at)}
                      </p>
                      {b.chat_summary ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                          {b.chat_summary}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {data && onEdit ? (
          <Button
            outline
            onClick={() => {
              onEdit(data)
            }}
          >
            <PencilSquareIcon data-slot="icon" className="size-4" />
            Edit client
          </Button>
        ) : null}
        <Button plain onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}

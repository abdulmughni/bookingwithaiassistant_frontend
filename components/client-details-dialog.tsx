'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogTitle } from '@/components/dialog'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Badge } from '@/components/badge'
import { SourceBadge } from '@/components/channel-icon'
import { useApiToken } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { CustomerDetail } from '@/lib/types'

export function ClientDetailsDialog({
  open,
  clientId,
  onClose,
  onUpdated,
}: {
  open: boolean
  clientId: string | null
  onClose: () => void
  onUpdated?: () => void
}) {
  const getToken = useApiToken()
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    email: '',
    primary_address: '',
    notes: '',
  })

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
      setForm({
        display_name: row.display_name,
        phone: row.phone ?? '',
        email: row.email ?? '',
        primary_address: row.primary_address ?? '',
        notes: row.notes ?? '',
      })
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

  const handleSave = async () => {
    const id = (clientId || '').trim()
    if (!id) return
    setSaving(true)
    try {
      const token = await getToken()
      await api.customers.update(token, id, {
        display_name: form.display_name,
        phone: form.phone || null,
        email: form.email || null,
        primary_address: form.primary_address || null,
        notes: form.notes || null,
      })
      notifySuccess('Client updated.')
      await load()
      onUpdated?.()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not save client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <div className="flex items-start justify-between gap-4">
        <DialogTitle className="text-lg font-semibold text-zinc-950 dark:text-white">
          {loading && !data ? 'Loading client…' : data?.display_name || 'Client'}
        </DialogTitle>
        <div className="flex shrink-0 items-center gap-2">
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
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-white/10 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Contact</h2>
            <label className="block text-xs text-zinc-500">
              Name
              <Input
                className="mt-1"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Phone
              <Input
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Email
              <Input
                className="mt-1"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Address
              <Input
                className="mt-1"
                value={form.primary_address}
                onChange={(e) => setForm((f) => ({ ...f, primary_address: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Notes
              <Input
                className="mt-1"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <Button color="brand" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
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

      <div className="mt-6 flex justify-end">
        <Button plain onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}

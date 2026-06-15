'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { Card, CardBody } from '@/components/card'
import { Input } from '@/components/input'
import { PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import { SourceBadge } from '@/components/channel-icon'
import { useApiToken } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { CustomerDetail } from '@/lib/types'

export default function ClientDetailPage() {
  const params = useParams()
  const customerId = decodeURIComponent(String(params.id ?? ''))
  const getToken = useApiToken()
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    email: '',
    primary_address: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const row = await api.customers.get(token, customerId)
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
  }, [getToken, customerId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      await api.customers.update(token, customerId, {
        display_name: form.display_name,
        phone: form.phone || null,
        email: form.email || null,
        primary_address: form.primary_address || null,
        notes: form.notes || null,
      })
      notifySuccess('Client updated.')
      await load()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not save client')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <p className="text-sm text-zinc-500">Client not found.</p>
        <Link href="/clients" className="mt-4 inline-block text-sm text-brand-600">
          ← Back to clients
        </Link>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ArrowLeftIcon className="size-4" />
        All clients
      </Link>

      <PageHeader
        title={data.display_name}
        description={`${data.bookings_count} booking${data.bookings_count === 1 ? '' : 's'} on file`}
      >
        {data.jobber_client_id ? <Badge color="lime">Linked to Jobber</Badge> : null}
      </PageHeader>

      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
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
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardBody>
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
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Booking history</h2>
              {data.bookings.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No bookings yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
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
            </CardBody>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

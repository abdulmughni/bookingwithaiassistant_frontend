'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { Card, CardBody } from '@/components/card'
import { Input } from '@/components/input'
import { PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/lib/types'

export default function ClientsPage() {
  const getToken = useApiToken()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const rows = await api.customers.list(token, { q: search || undefined, limit: 100 })
      setCustomers(rows)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [getToken, search])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Your end customers — deduplicated across chat, voice, and Jobber."
      />

      <div className="mb-4 flex max-w-md gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            className="pl-9"
            placeholder="Search name, phone, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(q.trim())
            }}
          />
        </div>
        <Button outline onClick={() => setSearch(q.trim())}>
          Search
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card className="border-dashed">
          <CardBody className="py-14 text-center text-sm text-zinc-500">
            No clients yet. They appear here when someone messages or books.
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${encodeURIComponent(c.id)}`}
                className="block rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:hover:border-brand-600/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-950 dark:text-white">{c.display_name}</p>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {[c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge color="zinc">{c.bookings_count} booking{c.bookings_count === 1 ? '' : 's'}</Badge>
                    {c.jobber_client_id ? <Badge color="lime">Jobber</Badge> : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Last seen {c.last_seen_at ? formatDate(c.last_seen_at) : '—'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}

'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { Card, CardBody } from '@/components/card'
import { Input, InputGroup } from '@/components/input'
import { FilterPanel, PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import { ClientDetailsDialog } from '@/components/client-details-dialog'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/lib/types'

function ClientsPageInner() {
  const getToken = useApiToken()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'box' | 'list'>('box')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

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

  useEffect(() => {
    const fromQuery = (searchParams.get('client') || '').trim()
    if (fromQuery) {
      setSelectedClientId(fromQuery)
    }
  }, [searchParams])

  const openClient = (id: string) => {
    setSelectedClientId(id)
    router.replace(`/clients?client=${encodeURIComponent(id)}`, { scroll: false })
  }

  const closeClient = () => {
    setSelectedClientId(null)
    router.replace('/clients', { scroll: false })
  }

  const runSearch = () => setSearch(q.trim())

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Your end customers — deduplicated across chat, voice, and Jobber."
      />

      <FilterPanel>
        <div className="min-w-56 flex-1">
          <InputGroup>
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              placeholder="Search name, phone, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
            />
          </InputGroup>
        </div>
        <Button outline onClick={runSearch}>
          Search
        </Button>
        <div className="ml-auto inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          <Button
            plain
            className={`px-3 py-1 text-xs ${viewMode === 'box' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            onClick={() => setViewMode('box')}
          >
            Box view
          </Button>
          <Button
            plain
            className={`px-3 py-1 text-xs ${viewMode === 'list' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List view
          </Button>
        </div>
      </FilterPanel>

      <div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border border-zinc-200/80 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <Card className="border-dashed">
            <CardBody className="py-14 text-center text-sm text-zinc-500">
              No clients yet. They appear here when someone books an appointment.
            </CardBody>
          </Card>
        ) : (
          <div key={viewMode} className="bookings-layout-animate">
            {viewMode === 'box' ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {customers.map((c) => (
                  <Card
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openClient(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openClient(c.id)
                      }
                    }}
                    className="cursor-pointer border border-zinc-200 shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:hover:border-brand-600/50"
                  >
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-zinc-950 dark:text-white">
                            {c.display_name}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                            {[c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge color="zinc">
                            {c.bookings_count} booking{c.bookings_count === 1 ? '' : 's'}
                          </Badge>
                          {c.jobber_client_id ? <Badge color="lime">Jobber</Badge> : null}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Last seen {c.last_seen_at ? formatDate(c.last_seen_at) : '—'}
                      </p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 xl:grid xl:grid-cols-[1.4fr_1.2fr_0.7fr_0.8fr_0.5fr] xl:gap-4 dark:text-zinc-400">
                  <span>Name</span>
                  <span>Contact</span>
                  <span>Bookings</span>
                  <span>Last seen</span>
                  <span>Jobber</span>
                </div>
                {customers.map((c) => (
                  <Card
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openClient(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openClient(c.id)
                      }
                    }}
                    className="cursor-pointer border border-zinc-200 shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:hover:border-brand-600/50"
                  >
                    <CardBody className="xl:grid xl:grid-cols-[1.4fr_1.2fr_0.7fr_0.8fr_0.5fr] xl:items-center xl:gap-4">
                      <div>
                        <p className="font-semibold text-zinc-950 dark:text-white">{c.display_name}</p>
                        <p className="mt-0.5 text-xs text-zinc-500 xl:hidden">
                          {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact'}
                        </p>
                      </div>
                      <p className="hidden truncate text-sm text-zinc-500 xl:block">
                        {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        <span className="font-medium xl:hidden">Bookings: </span>
                        {c.bookings_count}
                      </p>
                      <p className="text-sm text-zinc-500">
                        <span className="font-medium xl:hidden">Last seen: </span>
                        {c.last_seen_at ? formatDate(c.last_seen_at) : '—'}
                      </p>
                      <div>
                        {c.jobber_client_id ? (
                          <Badge color="lime">Yes</Badge>
                        ) : (
                          <span className="text-sm text-zinc-400">—</span>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ClientDetailsDialog
        open={Boolean(selectedClientId)}
        clientId={selectedClientId}
        onClose={closeClient}
        onUpdated={() => void load()}
      />
    </PageShell>
  )
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </PageShell>
      }
    >
      <ClientsPageInner />
    </Suspense>
  )
}

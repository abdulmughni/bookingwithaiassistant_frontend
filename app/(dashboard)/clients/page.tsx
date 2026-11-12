'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { Card, CardBody } from '@/components/card'
import { Input, InputGroup } from '@/components/input'
import { FilterPanel, PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import { ClientDetailsDialog } from '@/components/client-details-dialog'
import { ClientFormDialog } from '@/components/client-form-dialog'
import { ClientDeleteDialog } from '@/components/client-delete-dialog'
import { HoverIconActions } from '@/components/hover-icon-actions'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Customer } from '@/lib/types'
import { sampleCustomers, useClientPortalDemo } from '@/lib/client-portal-demo'

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function ClientsPageInner() {
  const getToken = useApiToken()
  const { enabled: showSample } = useClientPortalDemo()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'box' | 'list'>('box')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [formState, setFormState] = useState<{
    mode: 'create' | 'edit'
    client?: Customer | null
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const sampleRows = useMemo(() => {
    const today = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    return sampleCustomers(today, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  }, [])

  const load = useCallback(async () => {
    if (showSample) {
      const needle = search.trim().toLowerCase()
      setCustomers(
        needle
          ? sampleRows.filter((row) =>
              `${row.display_name} ${row.phone ?? ''} ${row.email ?? ''} ${row.primary_address ?? ''}`
                .toLowerCase()
                .includes(needle),
            )
          : sampleRows,
      )
      setLoading(false)
      return
    }
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
  }, [getToken, sampleRows, search, showSample])

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

  const openEdit = (client: Customer) => {
    setSelectedClientId(null)
    setFormState({ mode: 'edit', client })
  }

  const runSearch = () => setSearch(q.trim())

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Your end customers — deduplicated across chat, voice, and Jobber."
      >
        <Button color="brand" onClick={() => setFormState({ mode: 'create' })}>
          <PlusIcon data-slot="icon" />
          New client
        </Button>
      </PageHeader>

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
            className={`rounded-md px-3 py-1 text-xs ${viewMode === 'box' ? 'segment-on shadow-sm' : 'text-zinc-500 dark:text-zinc-300'}`}
            onClick={() => setViewMode('box')}
          >
            Box view
          </Button>
          <Button
            plain
            className={`rounded-md px-3 py-1 text-xs ${viewMode === 'list' ? 'segment-on shadow-sm' : 'text-zinc-500 dark:text-zinc-300'}`}
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
          <Card className="border-dashed border-zinc-300 dark:border-zinc-700">
            <CardBody className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {search ? 'No clients match your search' : 'No clients yet'}
                </p>
                <p className="text-sm text-zinc-500">
                  {search
                    ? 'Try a different name, phone, or email.'
                    : 'Add one manually, or they’ll appear here when someone books.'}
                </p>
              </div>
              {!search ? (
                <Button color="brand" onClick={() => setFormState({ mode: 'create' })}>
                  <PlusIcon data-slot="icon" />
                  New client
                </Button>
              ) : null}
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
                    className="group relative cursor-pointer border border-zinc-200 shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:hover:border-brand-600/50"
                  >
                    <HoverIconActions
                      onEdit={() => openEdit(c)}
                      onDelete={() => setDeleteTarget(c)}
                    />
                    <CardBody className="space-y-3">
                      <div className="flex items-start gap-3 pr-8">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                          {clientInitials(c.display_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-semibold text-zinc-950 dark:text-white">{c.display_name}</p>
                            <Badge color="zinc">{c.bookings_count} job{c.bookings_count === 1 ? '' : 's'}</Badge>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-300">{c.phone || 'No phone'}</p>
                          <p className="truncate text-sm text-zinc-500">{c.email || 'No email'}</p>
                        </div>
                      </div>
                      <p className="truncate text-sm text-zinc-500">{c.primary_address || 'No address on file'}</p>
                      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
                        <span>Last visit {c.last_seen_at ? formatDate(c.last_seen_at) : '—'}</span>
                        {c.jobber_client_id ? <Badge color="lime">In Jobber</Badge> : <span>Not in Jobber</span>}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="hidden grid-cols-[1.3fr_0.9fr_1.2fr_1.4fr_0.45fr_0.7fr] gap-3 border-b border-zinc-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 md:grid dark:border-zinc-800">
                  <span>Name</span>
                  <span>Phone</span>
                  <span>Email</span>
                  <span>Address</span>
                  <span>Jobs</span>
                  <span>Last visit</span>
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {customers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openClient(c.id)}
                        className="grid w-full gap-1 px-4 py-3 text-left transition hover:bg-zinc-50 md:grid-cols-[1.3fr_0.9fr_1.2fr_1.4fr_0.45fr_0.7fr] md:items-center md:gap-3 dark:hover:bg-zinc-800/60"
                      >
                        <span className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{c.display_name}</span>
                        <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">{c.phone || '—'}</span>
                        <span className="truncate text-sm text-zinc-500">{c.email || '—'}</span>
                        <span className="truncate text-sm text-zinc-500">{c.primary_address || '—'}</span>
                        <span className="text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-100">{c.bookings_count}</span>
                        <span className="text-sm text-zinc-500">{c.last_seen_at ? formatDate(c.last_seen_at) : '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <ClientDetailsDialog
        open={Boolean(selectedClientId)}
        clientId={selectedClientId}
        onClose={closeClient}
        onEdit={(client) => {
          setSelectedClientId(null)
          setFormState({ mode: 'edit', client })
        }}
      />

      <ClientFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        client={formState?.client}
        onClose={() => setFormState(null)}
        onSaved={() => void load()}
      />

      <ClientDeleteDialog
        open={deleteTarget !== null}
        client={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          if (deleteTarget && selectedClientId === deleteTarget.id) {
            closeClient()
          }
          void load()
        }}
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

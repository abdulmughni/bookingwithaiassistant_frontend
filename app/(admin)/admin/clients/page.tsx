'use client'

import { useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

import { Button } from '@/components/button'
import { Input, InputGroup } from '@/components/input'
import { Select } from '@/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { HealthDot, relativeActivity } from '@/components/admin/ops'
import { StatusBadge, UsageBar, formatDate } from '@/components/admin/shared'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'
import type { AccountStatus } from '@/lib/types'

type HealthFilter = 'all' | 'red' | 'yellow' | 'green'

export default function AdminClientsPage() {
  return (
    <Suspense fallback={<SkeletonBlock className="h-96" />}>
      <ClientsPageInner />
    </Suspense>
  )
}

function ClientsPageInner() {
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')
  const initialStatus: AccountStatus | 'all' =
    statusParam === 'active' || statusParam === 'pending' || statusParam === 'suspended'
      ? statusParam
      : 'all'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>(initialStatus)
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')

  const { data: tenants, loading, error, refetch } = useApiData(
    (token) => api.admin.listTenants(token),
    [],
  )

  const filtered = useMemo(() => {
    if (!tenants) return []
    const q = search.trim().toLowerCase()
    return tenants.filter((t) => {
      if (statusFilter !== 'all' && t.account_status !== statusFilter) return false
      if (healthFilter !== 'all' && (t.health ?? 'green') !== healthFilter) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.slug ?? '').toLowerCase().includes(q) ||
        (t.plan?.name ?? '').toLowerCase().includes(q) ||
        (t.industry_type ?? '').toLowerCase().includes(q)
      )
    })
  }, [tenants, search, statusFilter, healthFilter])

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Health-sorted client list. Click a row for funnel, bookings, and usage detail."
      >
        <Button outline onClick={() => void refetch()}>
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className={`${dashCardClass} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <InputGroup>
              <MagnifyingGlassIcon data-slot="icon" />
              <Input
                placeholder="Search by name, ID, trade, or plan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
          </div>
          <Select
            aria-label="Filter by status"
            className="max-w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select
            aria-label="Filter by health"
            className="max-w-40"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value as HealthFilter)}
          >
            <option value="all">All health</option>
            <option value="red">Red</option>
            <option value="yellow">Yellow</option>
            <option value="green">Green</option>
          </Select>
          <span className="text-sm text-zinc-500">
            {tenants ? `${filtered.length} of ${tenants.length}` : ''}
          </span>
        </div>
      </div>

      <div className={dashCardClass}>
        <div className="overflow-x-auto px-2 sm:px-4">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader className="w-10"> </TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Trade</TableHeader>
                <TableHeader>Plan</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="w-36">Minutes</TableHeader>
                <TableHeader className="w-36">Messages</TableHeader>
                <TableHeader className="text-right">Bookings (mo)</TableHeader>
                <TableHeader>Last activity</TableHeader>
                <TableHeader>Activated</TableHeader>
                <TableHeader className="w-8"> </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-zinc-500">
                    Loading clients…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-zinc-500">
                    {tenants?.length === 0 ? 'No clients yet.' : 'No clients match your filters.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => {
                const activity = relativeActivity(t.last_activity_at)
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    href={`/admin/clients/${encodeURIComponent(t.id)}`}
                    title={`Manage ${t.name}`}
                  >
                    <TableCell>
                      <HealthDot health={t.health ?? 'green'} size="md" />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-zinc-950 dark:text-white">{t.name}</div>
                      <div className="font-mono text-xs text-zinc-400">{t.id}</div>
                    </TableCell>
                    <TableCell className="capitalize text-zinc-600 dark:text-zinc-300">
                      {t.industry_type || '—'}
                    </TableCell>
                    <TableCell>
                      {t.plan ? t.plan.name : <span className="text-zinc-400">No plan</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.account_status} />
                    </TableCell>
                    <TableCell>
                      <UsageBar
                        used={t.usage.call_minutes_used}
                        quota={t.usage.call_minutes_quota}
                        label="Min"
                      />
                    </TableCell>
                    <TableCell>
                      <UsageBar
                        used={t.usage.messages_used}
                        quota={t.usage.messages_quota}
                        label="Msg"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.bookings_this_month ?? 0}
                    </TableCell>
                    <TableCell
                      className={clsx(
                        'text-sm',
                        activity.stale
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : 'text-zinc-500',
                      )}
                    >
                      {activity.label}
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {formatDate(t.activated_at ?? t.created_at)}
                    </TableCell>
                    <TableCell>
                      <ChevronRightIcon className="size-4 text-zinc-400" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageShell>
  )
}

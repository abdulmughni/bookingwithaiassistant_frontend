'use client'

import { useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { toast } from 'sonner'

import { InviteCompanyDialog } from '@/components/admin/invite-company-dialog'
import { Button } from '@/components/button'
import { PageHeader, PageShell, dashCardClass } from '@/components/dashboard-ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { api } from '@/lib/api'
import { useApiData } from '@/lib/hooks'

export default function AdminAgenciesPage() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const { data: agencies, loading, error, refetch } = useApiData(
    (token) => api.admin.listAgencies(token),
    [],
  )

  return (
    <PageShell>
      <PageHeader
        title="Agencies"
        description="Invite an agency, then open it to invite that agency's clients."
      >
        <Button color="brand" onClick={() => setInviteOpen(true)}>
          Invite agency
        </Button>
        <Button outline onClick={() => void refetch()}>
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className={dashCardClass}>
        <div className="overflow-x-auto px-2 sm:px-4">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Agency</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Clients</TableHeader>
                <TableHeader className="w-8"> </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                    Loading agencies…
                  </TableCell>
                </TableRow>
              )}
              {!loading && (agencies?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                    No agencies yet.
                  </TableCell>
                </TableRow>
              )}
              {(agencies ?? []).map((agency) => (
                <TableRow
                  key={agency.id}
                  href={`/admin/agencies/${encodeURIComponent(agency.id)}`}
                  title={`Open ${agency.name}`}
                >
                  <TableCell>
                    <div className="font-medium text-zinc-950 dark:text-white">{agency.name}</div>
                    <div className="font-mono text-xs text-zinc-400">{agency.id}</div>
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-300">
                    {agency.email || '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">{agency.client_count}</TableCell>
                  <TableCell>
                    <ChevronRightIcon className="size-4 text-zinc-400" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <InviteCompanyDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite an agency"
        description="They receive an email to create their login. Their organization is only the login and the brand."
        submitLabel="Send invitation"
        onSubmit={async (token, input) => {
          await api.admin.inviteAgency(token, input)
          toast.success('Invitation sent')
          await refetch()
        }}
      />
    </PageShell>
  )
}

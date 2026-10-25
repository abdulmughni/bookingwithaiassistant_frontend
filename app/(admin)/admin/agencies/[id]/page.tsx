'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { toast } from 'sonner'

import { AgencyBrandForm } from '@/components/admin/agency-brand-form'
import { InviteCompanyDialog } from '@/components/admin/invite-company-dialog'
import { Button } from '@/components/button'
import { PageHeader, PageShell, dashCardClass } from '@/components/dashboard-ui'
import { Field, Label } from '@/components/fieldset'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { StatusBadge } from '@/components/admin/shared'
import { api } from '@/lib/api'
import { useApiData, useApiToken } from '@/lib/hooks'

export default function AdminAgencyDetailPage() {
  const params = useParams<{ id: string }>()
  const agencyId = decodeURIComponent(params.id)
  const getToken = useApiToken()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [attachId, setAttachId] = useState('')
  const [attaching, setAttaching] = useState(false)

  const agency = useApiData((token) => api.admin.getAgency(token, agencyId), [agencyId])
  const clients = useApiData(
    (token) => api.admin.listTenants(token, { parentId: agencyId }),
    [agencyId],
  )
  const unassigned = useApiData(
    (token) => api.admin.listTenants(token, { unassigned: true }),
    [agencyId],
  )

  const displayName = name ?? agency.data?.name ?? ''

  async function saveName() {
    const next = displayName.trim()
    if (!next) return
    setSavingName(true)
    try {
      const token = await getToken()
      await api.admin.renameAgency(token, agencyId, next)
      setName(null)
      toast.success('Name saved')
      await agency.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the name.')
    } finally {
      setSavingName(false)
    }
  }

  async function attach() {
    if (!attachId) return
    setAttaching(true)
    try {
      const token = await getToken()
      await api.admin.attachClient(token, agencyId, attachId)
      setAttachId('')
      toast.success('Client moved under this agency')
      await Promise.all([clients.refetch(), unassigned.refetch(), agency.refetch()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not move that client.')
    } finally {
      setAttaching(false)
    }
  }

  return (
    <PageShell>
      <p className="text-sm">
        <Link href="/admin/agencies" className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Agencies
        </Link>
      </p>
      <PageHeader
        title={agency.data?.name || 'Agency'}
        description={agency.data?.email || agency.error || 'Loading…'}
      >
        <Button color="brand" onClick={() => setInviteOpen(true)}>
          Invite client
        </Button>
      </PageHeader>

      <section className={`${dashCardClass} space-y-4 p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Company name</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-64 flex-1">
            <Label>Name</Label>
            <Input value={displayName} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button outline disabled={savingName || !displayName.trim()} onClick={() => void saveName()}>
            {savingName ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      </section>

      <section className={`${dashCardClass} space-y-4 p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Brand</h2>
        <p className="text-sm text-zinc-500">
          This logo and these colors show on the agency screens and on this agency&apos;s client dashboards.
        </p>
        <AgencyBrandForm agencyId={agencyId} />
      </section>

      <section className={`${dashCardClass} space-y-4 p-5 sm:p-6`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Move an existing client</h2>
        <p className="text-sm text-zinc-500">
          Dummy clients stay on the Clients list until you place them under an agency.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-64 flex-1">
            <Label>Unassigned client</Label>
            <Select value={attachId} onChange={(e) => setAttachId(e.target.value)}>
              <option value="">Select a client</option>
              {(unassigned.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button outline disabled={!attachId || attaching} onClick={() => void attach()}>
            {attaching ? 'Moving…' : 'Move here'}
          </Button>
        </div>
      </section>

      <div className={dashCardClass}>
        <div className="overflow-x-auto px-2 sm:px-4">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Client</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="w-8"> </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.loading && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-zinc-500">
                    Loading clients…
                  </TableCell>
                </TableRow>
              )}
              {!clients.loading && (clients.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-zinc-500">
                    No clients under this agency yet.
                  </TableCell>
                </TableRow>
              )}
              {(clients.data ?? []).map((client) => (
                <TableRow
                  key={client.id}
                  href={`/admin/clients/${encodeURIComponent(client.id)}`}
                  title={`Manage ${client.name}`}
                >
                  <TableCell>
                    <div className="font-medium text-zinc-950 dark:text-white">{client.name}</div>
                    <div className="font-mono text-xs text-zinc-400">{client.id}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={client.account_status} />
                  </TableCell>
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
        title="Invite a client"
        description="The client gets their own organization and email. This agency manages their setup."
        submitLabel="Send invitation"
        onSubmit={async (token, input) => {
          await api.admin.inviteClient(token, agencyId, input)
          toast.success('Invitation sent')
          await Promise.all([clients.refetch(), agency.refetch()])
        }}
      />
    </PageShell>
  )
}

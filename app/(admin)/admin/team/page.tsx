'use client'

import { useState } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

import { AgencyOnly } from '@/components/admin/agency-only'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { Tip } from '@/components/tooltip'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken, useIsAdmin } from '@/lib/hooks'
import type { AgencyStaffMember } from '@/lib/types'

const STAFF_LIMIT = 5

function displayName(person: AgencyStaffMember) {
  const name = person.name?.trim()
  if (name && name.toLowerCase() !== person.email.toLowerCase()) return name
  return person.email
}

function displayEmail(person: AgencyStaffMember) {
  const name = person.name?.trim()
  if (!name || name.toLowerCase() === person.email.toLowerCase()) return null
  return person.email
}

function initials(person: AgencyStaffMember) {
  const source = displayName(person)
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

export default function AgencyTeamPage() {
  return (
    <AgencyOnly>
      <TeamBody />
    </AgencyOnly>
  )
}

function TeamBody() {
  const { isAgencyStaff } = useIsAdmin()
  const getToken = useApiToken()
  const { data, loading, error, refetch } = useApiData((token) => api.admin.listStaff(token), [])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [layout, setLayout] = useState<'box' | 'list'>('box')
  const staff = data?.staff ?? []
  const full = staff.length >= STAFF_LIMIT

  async function invite() {
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.inviteStaff(token, { email: email.trim(), name: name.trim() })
      setEmail('')
      setName('')
      toast.success('Invitation sent')
      await refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send the invitation.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(staffId: string) {
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.removeStaff(token, staffId)
      toast.success('Removed')
      await refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove that person.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Team"
        description="People who can sign in to this agency. Staff can view clients. They cannot change brand, billing, packs, or invites."
      >
        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800" role="tablist" aria-label="Team layout">
          {(['box', 'list'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayout(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 ${layout === id ? 'view-switch-on' : ''}`}
            >
              {id === 'box' ? 'Box' : 'List'}
            </button>
          ))}
        </div>
      </PageHeader>

      {loading && !data ? <SkeletonBlock className="h-32" /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data?.owner ? <OwnerCard person={data.owner} /> : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Staff</h2>
          <p className="text-xs text-zinc-500">{staff.length} of {STAFF_LIMIT}</p>
        </div>
        {staff.length === 0 ? (
          <p className={`${dashCardClass} px-5 py-8 text-center text-sm text-zinc-500`}>No staff yet. Invite someone below.</p>
        ) : layout === 'box' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {staff.map((person) => (
              <StaffCard key={person.id} person={person} busy={busy} canRemove={!isAgencyStaff} onRemove={() => void remove(person.id)} />
            ))}
          </div>
        ) : (
          <div className={`${dashCardClass} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium text-zinc-950 dark:text-white">{displayEmail(person) ? displayName(person) : '—'}</td>
                    <td className="px-3 py-3 text-zinc-500">{person.email}</td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300">Staff</td>
                    <td className="px-4 py-3 text-right">
                      {isAgencyStaff ? null : (
                        <RemoveButton disabled={busy} onClick={() => void remove(person.id)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAgencyStaff ? null : (
        <section className={`${dashCardClass} p-5`}>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Invite a staff member</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {full
              ? 'This agency already has 5 staff members. Remove someone before inviting another.'
              : 'Send a sign-in invitation. You can add up to 5 staff members.'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-zinc-500">Name</span>
              <Input className="mt-1" value={name} disabled={full} placeholder="Alex Rivera" onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Invitation email</span>
              <Input className="mt-1" type="email" value={email} disabled={full} placeholder="name@company.com" onChange={(event) => setEmail(event.target.value)} />
            </label>
          </div>
          <Button className="mt-4" color="brand" disabled={busy || full || !email.trim() || !name.trim()} onClick={() => void invite()}>
            {busy ? 'Sending…' : 'Send invitation'}
          </Button>
        </section>
      )}
    </PageShell>
  )
}

function OwnerCard({ person }: { person: AgencyStaffMember }) {
  const email = displayEmail(person)
  return (
    <article className={`${dashCardClass} overflow-hidden`}>
      <div className="theme-hero h-1.5" />
      <div className="flex items-center gap-4 p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-lg font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
          {initials(person)}
        </span>
        <div className="min-w-0">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Owner</span>
          <p className="mt-1 truncate text-lg font-semibold text-zinc-950 dark:text-white">{displayName(person)}</p>
          {email ? <p className="truncate text-sm text-zinc-500">{email}</p> : null}
        </div>
      </div>
    </article>
  )
}

function StaffCard({
  person,
  busy,
  canRemove,
  onRemove,
}: {
  person: AgencyStaffMember
  busy: boolean
  canRemove: boolean
  onRemove: () => void
}) {
  const email = displayEmail(person)
  return (
    <article className={`${dashCardClass} flex items-start gap-3 p-4`}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
        {initials(person)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-zinc-950 dark:text-white">{displayName(person)}</p>
        {email ? <p className="truncate text-sm text-zinc-500">{email}</p> : null}
        <p className="mt-1 text-xs text-zinc-400">Staff</p>
      </div>
      {canRemove ? <RemoveButton disabled={busy} onClick={onRemove} /> : null}
    </article>
  )
}

function RemoveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Tip content="Remove">
      <button
        type="button"
        aria-label="Remove"
        disabled={disabled}
        onClick={onClick}
        className="inline-flex size-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
      >
        <TrashIcon className="size-4" />
      </button>
    </Tip>
  )
}

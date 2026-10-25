'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { AgencyOnly } from '@/components/admin/agency-only'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken, useIsAdmin } from '@/lib/hooks'

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
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function invite() {
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.inviteStaff(token, email.trim())
      setEmail('')
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
      />
      {loading ? <SkeletonBlock className="h-32" /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {data?.owner ? (
        <article className={`${dashCardClass} p-5`}>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Owner</p>
          <p className="mt-1 font-medium text-zinc-950 dark:text-white">{data.owner.name || data.owner.email}</p>
          <p className="text-sm text-zinc-500">{data.owner.email}</p>
        </article>
      ) : null}
      <section className={`${dashCardClass} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Staff</h2>
        {(data?.staff.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No staff yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {data?.staff.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium text-zinc-950 dark:text-white">{person.name || person.email}</span>
                  <span className="mt-0.5 block text-zinc-500">{person.email}</span>
                </span>
                {isAgencyStaff ? null : (
                  <Button outline disabled={busy} onClick={() => void remove(person.id)}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAgencyStaff ? null : (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Input
              className="max-w-sm"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button color="brand" disabled={busy || !email.trim()} onClick={() => void invite()}>
              {busy ? 'Sending…' : 'Invite staff'}
            </Button>
          </div>
        )}
      </section>
    </PageShell>
  )
}

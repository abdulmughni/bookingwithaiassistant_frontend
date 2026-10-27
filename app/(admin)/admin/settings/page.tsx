'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

import { AgencyBrandForm } from '@/components/admin/agency-brand-form'
import { AgencyOnly } from '@/components/admin/agency-only'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken, useIsAdmin } from '@/lib/hooks'

export default function AgencySettingsPage() {
  return (
    <AgencyOnly>
      <SettingsBody />
    </AgencyOnly>
  )
}

function SettingsBody() {
  const { user } = useUser()
  const { tenantId, isAgencyStaff } = useIsAdmin()
  const getToken = useApiToken()
  const agency = useApiData(
    (token) => (tenantId ? api.admin.getAgency(token, tenantId) : Promise.resolve(null)),
    [tenantId],
  )
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'general' | 'brand'>('general')

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('tab')
    if (value === 'brand') setTab('brand')
  }, [])

  useEffect(() => {
    if (agency.data?.name) setName(agency.data.name)
  }, [agency.data?.name])

  async function save() {
    if (!tenantId) return
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.renameAgency(token, tenantId, name.trim())
      toast.success('Agency name saved')
      window.dispatchEvent(new Event('agency-brand-changed'))
      await agency.refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the name.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Agency details now, and more sections here later."
      />
      <div className="flex gap-1 border-b border-zinc-200">
        {(
          [
            ['general', 'General'],
            ['brand', 'Brand & White Label'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {agency.loading ? <SkeletonBlock className="h-32" /> : null}
      {agency.error ? <p className="text-sm text-red-600">{agency.error}</p> : null}
      {tab === 'general' ? (
        <section className={`${dashCardClass} max-w-xl space-y-4 p-5`}>
          <label className="block text-sm">
            <span className="font-medium text-zinc-950 dark:text-white">Agency name</span>
            <Input className="mt-2" value={name} disabled={isAgencyStaff} onChange={(event) => setName(event.target.value)} />
          </label>
          <p className="text-sm text-zinc-500">
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? 'your account'}
          </p>
          {isAgencyStaff ? null : (
            <Button color="brand" disabled={busy || !name.trim()} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save name'}
            </Button>
          )}
        </section>
      ) : (
        <section className={`${dashCardClass} p-5 sm:p-6`}>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Brand & White Label</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-500">
            Logo and colors appear on your screens and on your clients&apos; dashboards.
          </p>
          {isAgencyStaff ? (
            <p className="text-sm text-zinc-500">Only the agency owner can change the logo and colors.</p>
          ) : tenantId ? (
            <AgencyBrandForm agencyId={tenantId} />
          ) : null}
        </section>
      )}
    </PageShell>
  )
}

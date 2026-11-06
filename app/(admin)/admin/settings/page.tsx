'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

import { AgencyBrandForm } from '@/components/admin/agency-brand-form'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { PageHeader, PageShell, SkeletonBlock, dashCardClass, settingsTabClass } from '@/components/dashboard-ui'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken, useIsAdmin } from '@/lib/hooks'

export default function AgencySettingsPage() {
  const { isAgency, loading } = useIsAdmin()
  if (loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }
  if (!isAgency) return <ConsoleAppearance />
  return <SettingsBody />
}

function ConsoleAppearance() {
  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Colors and light or dark mode for the admin console on this browser."
      />
      <section className={`${dashCardClass} p-5 sm:p-6`}>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Brand & White Label</h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500">
          Presets and colors apply to the admin console on this browser. Agency and client colors stay on their own accounts.
        </p>
        <AgencyBrandForm showLogo={false} persist="browser" />
      </section>
    </PageShell>
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
  const [tab, setTab] = useState<'agency' | 'colors'>('agency')

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('tab')
    if (value === 'brand' || value === 'colors') setTab('colors')
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
        description="The sidebar name and logo. Your own name, photo, and email are on the account card at the bottom of the menu."
      />
      <div className={`${dashCardClass} overflow-hidden`}>
      <div className="flex gap-6 overflow-x-auto border-b border-zinc-200/80 px-4 pt-2 dark:border-zinc-700/80 sm:px-6">
        {(
          [
            ['agency', 'Agency'],
            ['colors', 'Colors'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={settingsTabClass(tab === id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-6">
      {agency.error ? <p className="text-sm text-red-600">{agency.error}</p> : null}
      {agency.loading && !agency.data ? <SkeletonBlock className="h-24" /> : tab === 'agency' ? (
        <section className="max-w-xl space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Name and logo</h2>
            <p className="mt-1 text-sm text-zinc-500">
              These sit together in the sidebar and on your clients&apos; screens.
            </p>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-zinc-950 dark:text-white">Agency name</span>
            <Input className="mt-2" value={name} disabled={isAgencyStaff} onChange={(event) => setName(event.target.value)} />
          </label>
          <p className="text-sm text-zinc-500">
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? 'your account'}
          </p>
          {isAgencyStaff ? (
            <p className="text-sm text-zinc-500">Only the agency owner can change the name and logo.</p>
          ) : (
            <>
              <Button color="brand" disabled={busy || !name.trim()} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save name'}
              </Button>
              {tenantId ? <AgencyBrandForm agencyId={tenantId} part="logo" /> : null}
            </>
          )}
        </section>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Colors</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-500">
            Light or dark mode, presets, and the colors used on your screens and your clients&apos; dashboards.
          </p>
          {isAgencyStaff ? (
            <p className="text-sm text-zinc-500">Only the agency owner can change the colors.</p>
          ) : tenantId ? (
            <AgencyBrandForm agencyId={tenantId} part="colors" />
          ) : null}
        </section>
      )}
      </div>
      </div>
    </PageShell>
  )
}

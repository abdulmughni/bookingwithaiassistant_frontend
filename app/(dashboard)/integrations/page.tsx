'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Card, CardBody } from '@/components/card'
import { useApiData, useApiToken, useFreshOrgToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import type { Credential, Tenant } from '@/lib/types'

function integrationLabel(type: string): string {
  switch (type) {
    case 'jobber':
      return 'Jobber'
    case 'hubspot':
      return 'HubSpot'
    case 'vapi':
      return 'Vapi voice'
    default:
      return type
  }
}

function integrationAccent(type: string): string {
  switch (type) {
    case 'jobber':
      return 'border-l-lime-500'
    case 'hubspot':
      return 'border-l-orange-500'
    case 'vapi':
      return 'border-l-violet-500'
    default:
      return 'border-l-zinc-400'
  }
}

function IntegrationCard({
  cred,
  tenant,
  onRemove,
}: {
  cred: Credential
  tenant: Tenant | null
  onRemove: () => void
}) {
  const jobberLinked =
    cred.integration_type === 'jobber' &&
    tenant?.crm_type === 'jobber' &&
    tenant?.crm_credential_ref === cred.ref
  const jobberNeedsReconnect =
    jobberLinked && Boolean(tenant?.crm_settings?.jobber_needs_reconnect)

  return (
    <Card
      className={clsx(
        'flex flex-col border border-zinc-200 border-l-4 bg-white/95 pl-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:border-zinc-600 sm:pl-5',
        integrationAccent(cred.integration_type),
      )}
    >
      <CardBody className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                color={
                  cred.integration_type === 'jobber'
                    ? 'lime'
                    : cred.integration_type === 'hubspot'
                      ? 'orange'
                      : 'violet'
                }
                className="capitalize"
              >
                {integrationLabel(cred.integration_type)}
              </Badge>
              <Badge color={cred.exists ? 'lime' : 'red'}>{cred.exists ? 'Credentials' : 'Missing'}</Badge>
              {jobberLinked && (
                <Badge color="lime" className="text-[10px]">
                  Workspace linked
                </Badge>
              )}
              {jobberNeedsReconnect && (
                <Badge color="amber" className="text-[10px]">
                  Reconnect required
                </Badge>
              )}
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
              {integrationLabel(cred.integration_type)}
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Updated {formatDate(cred.updated_at)}
          </span>
        </div>

        {jobberNeedsReconnect ? (
          <p className="mt-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-50">
            Live calendar sync is paused. Click <strong>Connect Jobber</strong> below to
            reconnect — customers cannot get accurate availability until this is fixed.
            {tenant?.crm_settings?.jobber_last_error ? (
              <>
                {' '}
                <span className="block mt-1 opacity-80">
                  {tenant.crm_settings.jobber_last_error}
                </span>
              </>
            ) : null}
          </p>
        ) : null}

        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          {cred.integration_type === 'jobber' ? (
            <>
              Bookings confirmed in chat or by phone sync to Jobber as Jobs; clients are matched or
              created by phone. In the Jobber Developer Center, set your app webhook URL to{' '}
              <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[10px] dark:bg-zinc-700">
                {typeof process.env.NEXT_PUBLIC_API_BASE_URL === 'string' &&
                process.env.NEXT_PUBLIC_API_BASE_URL
                  ? `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/webhooks/jobber`
                  : 'https://<your-api>/webhooks/jobber'}
              </code>{' '}
              and subscribe to visit/job events so availability stays in sync.
            </>
          ) : cred.integration_type === 'hubspot' ? (
            <>CRM sync — connect credentials here, then choose HubSpot under Settings → Integrations.</>
          ) : cred.integration_type === 'vapi' ? (
            <>Voice API credentials for this workspace.</>
          ) : (
            <>Encrypted credentials for this integration.</>
          )}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-950/10 pt-4 dark:border-white/10">
          <Button plain className="text-xs font-medium text-red-600 dark:text-red-400" onClick={onRemove}>
            {cred.integration_type === 'jobber' ? 'Disconnect' : 'Remove'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function IntegrationsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showConnect, setShowConnect] = useState(false)
  const [jobberOauthLoading, setJobberOauthLoading] = useState(false)
  const getToken = useApiToken()
  const getFreshToken = useFreshOrgToken()

  const { data: tenant, loading: tenantLoading, refetch: refetchTenant } = useApiData<Tenant>(
    (token) => api.tenants.me(token),
  )

  const { data: credentials, loading, refetch } = useApiData<Credential[]>(
    (token) => api.credentials.list(token),
  )

  const visibleCredentials =
    credentials?.filter((c) => c.integration_type !== 'gcal' && c.integration_type !== 'calcom') ?? []

  useEffect(() => {
    const jobber = searchParams.get('jobber_oauth')
    if (!jobber) return
    const msg = searchParams.get('message')
    if (jobber === 'success') {
      notifySuccess('Jobber connected.')
      refetchTenant()
      refetch()
    } else if (jobber === 'error') {
      notifyError(msg || 'Jobber connection failed.')
    }
    router.replace('/integrations')
  }, [searchParams, router, refetchTenant, refetch])

  const handleJobberOAuth = async () => {
    setJobberOauthLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) {
        notifyError('Select a workspace (organization) before connecting Jobber.')
        setJobberOauthLoading(false)
        return
      }
      const { authorization_url } = await api.oauth.jobberStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start Jobber connection')
      setJobberOauthLoading(false)
    }
  }

  const handleDelete = async (cred: Credential) => {
    try {
      const token = await getToken()
      const ref = cred.ref
      const isLinkedJobber =
        cred.integration_type === 'jobber' &&
        tenant?.crm_credential_ref === ref &&
        tenant?.crm_type === 'jobber'

      if (isLinkedJobber) {
        await api.oauth.jobberDisconnect(token)
        refetchTenant()
      } else {
        await api.credentials.remove(token, ref)
      }
      notifySuccess('Integration removed')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not remove integration')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Integrations</Heading>
          <Text className="mt-1">
            Connect Jobber so AI-confirmed bookings from messages and calls appear on your Jobber schedule.
            More field-service CRMs will be added here over time.
          </Text>
        </div>
        <Button onClick={() => setShowConnect(true)}>Add integration</Button>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6">
        {loading || tenantLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl border border-zinc-950/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : visibleCredentials.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCredentials.map((cred) => (
              <IntegrationCard
                key={cred.ref}
                cred={cred}
                tenant={tenant ?? null}
                onRemove={() => void handleDelete(cred)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="py-12 text-center">
              <Text>No integrations yet</Text>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                Connect Jobber to sync visits from AI chat and voice into your Jobber account.
              </p>
              <Button className="mt-6" onClick={() => setShowConnect(true)}>
                Add integration
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      <Dialog open={showConnect} onClose={setShowConnect} size="3xl">
        <DialogTitle>Connect integration</DialogTitle>
        <DialogDescription>
          Bookings created by the AI use your CRM for the live schedule — there is no separate Google Calendar
          connection.
        </DialogDescription>

        <DialogBody className="max-h-[70vh] overflow-y-auto pr-1">
          <div
            className={clsx(
              'rounded-2xl bg-zinc-100/90 p-4 dark:bg-zinc-800/50',
              'ring-1 ring-zinc-950/5 dark:ring-white/10',
            )}
          >
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Field service CRM
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleJobberOAuth()}
                disabled={jobberOauthLoading}
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 disabled:opacity-60 dark:bg-zinc-900 dark:ring-white/10 dark:hover:bg-zinc-800"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/15 text-lime-700 dark:text-lime-300">
                  <span className="font-bold">J</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white">Jobber</p>
                  <p className="text-xs text-zinc-500">Sign in with Jobber · pushes bookings to your schedule</p>
                </div>
                <Badge color="lime" className="shrink-0">
                  {jobberOauthLoading ? '…' : 'Live'}
                </Badge>
              </button>
              <button
                type="button"
                onClick={() => notifyError('Housecall Pro integration is not available yet.')}
                className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900/80 dark:ring-white/10"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  H
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-600 dark:text-zinc-400">Housecall Pro</p>
                  <p className="text-xs text-zinc-400">Field service scheduling</p>
                </div>
                <Badge color="zinc" className="shrink-0 text-[10px]">
                  Soon
                </Badge>
              </button>
            </div>
          </div>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={() => setShowConnect(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      }
    >
      <IntegrationsPageInner />
    </Suspense>
  )
}

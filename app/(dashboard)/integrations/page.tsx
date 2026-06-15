'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Card, CardBody } from '@/components/card'
import { JobberConnectingOverlay } from '@/components/jobber-connecting-overlay'
import { useApiData, useApiToken, useFreshOrgToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import {
  clearJobberMarketplaceOAuthGuard,
  isJobberMarketplaceLaunch,
  jobberMarketplaceOAuthAlreadyStarted,
  markJobberMarketplaceOAuthStarted,
  shouldKickstartJobberOAuth,
} from '@/lib/jobber-oauth'
import type { Credential, Tenant } from '@/lib/types'

const JOBBER_LOGO = '/images/getjobber-logo.jpg'

/** Logo sized by height only (w-auto) so the frame hugs the image — no side gaps. */
function JobberLogoFrame({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const height =
    size === 'sm'
      ? 'h-14 sm:h-16'
      : size === 'lg'
        ? 'h-20 sm:h-24'
        : 'h-16 sm:h-[4.5rem]'
  const rounded = size === 'lg' ? 'rounded-2xl' : 'rounded-xl'

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset in /public
    <img
      src={JOBBER_LOGO}
      alt="Jobber"
      className={clsx(
        'block w-auto shrink-0 border border-zinc-200/90 object-cover dark:border-zinc-600/80',
        height,
        rounded,
        className,
      )}
    />
  )
}

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

function IntegrationBrandMark({
  type,
  size = 'md',
}: {
  type: string
  size?: 'md' | 'lg'
}) {
  if (type === 'jobber') {
    return (
      <JobberLogoFrame size={size === 'lg' ? 'lg' : 'md'} />
    )
  }
  const styles: Record<string, string> = {
    hubspot: 'bg-orange-500/15 text-orange-700 ring-orange-500/20 dark:text-orange-300',
    vapi: 'bg-violet-500/15 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  }
  const letter = type === 'hubspot' ? 'H' : type === 'vapi' ? 'V' : '?'
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1',
        size === 'lg' ? 'size-14 text-base' : 'size-11',
        styles[type] ?? 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/15 dark:text-zinc-300',
      )}
    >
      {letter}
    </span>
  )
}

function JobberIntegrationDescription() {
  return (
    <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
      <p>
        OAuth links your workspace to Jobber. When customers book through Facebook, Instagram,
        Messenger, or phone, we create or update clients, jobs, and visits on your live Jobber
        schedule.
      </p>
      <ul className="list-disc space-y-1 pl-4 text-[13px] text-zinc-500 dark:text-zinc-400">
        <li>Availability reflects visits and jobs already on your Jobber calendar</li>
        <li>Webhooks keep open slots aligned when schedules change in Jobber</li>
        <li>Disconnect anytime — stored tokens are removed immediately</li>
      </ul>
    </div>
  )
}

function integrationSummary(type: string): string {
  switch (type) {
    case 'jobber':
      return ''
    case 'hubspot':
      return 'CRM sync for contacts and deals.'
    case 'vapi':
      return 'Voice assistant API credentials.'
    default:
      return 'Connected credentials for this workspace.'
  }
}

function integrationStatus(
  cred: Credential,
  tenant: Tenant | null,
): { label: string; color: 'lime' | 'amber' | 'red' | 'zinc' } {
  const jobberLinked =
    cred.integration_type === 'jobber' &&
    tenant?.crm_type === 'jobber' &&
    tenant?.crm_credential_ref === cred.ref
  const jobberNeedsReconnect =
    jobberLinked && Boolean(tenant?.crm_settings?.jobber_needs_reconnect)

  if (!cred.exists) return { label: 'Not configured', color: 'red' }
  if (jobberNeedsReconnect) return { label: 'Reconnect required', color: 'amber' }
  if (jobberLinked || cred.exists) return { label: 'Connected', color: 'lime' }
  return { label: 'Connected', color: 'lime' }
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
  const status = integrationStatus(cred, tenant)
  const jobberNeedsReconnect =
    cred.integration_type === 'jobber' &&
    tenant?.crm_type === 'jobber' &&
    tenant?.crm_credential_ref === cred.ref &&
    Boolean(tenant?.crm_settings?.jobber_needs_reconnect)

  return (
    <Card className="overflow-hidden border-zinc-200/80 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:hover:border-zinc-600">
      <CardBody className="p-0">
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <IntegrationBrandMark type={cred.integration_type} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                {integrationLabel(cred.integration_type)}
              </h3>
              <Badge color={status.color} className="text-[10px]">
                {status.label}
              </Badge>
            </div>
            {cred.integration_type === 'jobber' ? (
              <JobberIntegrationDescription />
            ) : (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {integrationSummary(cred.integration_type)}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Updated {formatDate(cred.updated_at)}
            </p>
          </div>
        </div>

        {jobberNeedsReconnect ? (
          <div className="border-t border-amber-200/80 bg-amber-50/90 px-5 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-100 sm:px-6">
            Calendar sync is paused. Use <strong>Connect Jobber</strong> to sign in again.
            {tenant?.crm_settings?.jobber_last_error ? (
              <span className="mt-1 block text-xs opacity-80">
                {tenant.crm_settings.jobber_last_error}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-zinc-950/5 px-5 py-3 dark:border-white/10 sm:px-6">
          <Button
            plain
            className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            onClick={onRemove}
          >
            {cred.integration_type === 'jobber' ? 'Disconnect' : 'Remove'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function ConnectProviderRow({
  title,
  subtitle,
  letter,
  logoSrc,
  accent,
  badge,
  badgeColor,
  disabled,
  loading,
  onClick,
}: {
  title: string
  subtitle: string
  letter?: string
  logoSrc?: string
  accent: string
  badge: string
  badgeColor: 'lime' | 'zinc'
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition',
        disabled
          ? 'cursor-default border-zinc-200/80 bg-zinc-50/50 opacity-90 dark:border-zinc-700/60 dark:bg-zinc-800/30'
          : 'border-zinc-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand-600/50 dark:hover:bg-brand-950/30',
        (disabled || loading) && 'pointer-events-none',
      )}
    >
      {logoSrc ? (
        <JobberLogoFrame size="sm" />
      ) : (
        <span
          className={clsx(
            'flex size-12 shrink-0 items-center justify-center rounded-xl text-base font-bold ring-1',
            accent,
          )}
        >
          {letter}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'font-semibold',
            disabled ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-white',
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge color={badgeColor} className="text-[10px]">
          {loading ? '…' : badge}
        </Badge>
        {!disabled && !loading ? (
          <ChevronRightIcon className="size-5 text-zinc-300 transition group-hover:text-brand-600 dark:text-zinc-600 dark:group-hover:text-brand-400" />
        ) : null}
      </div>
    </button>
  )
}

function IntegrationsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showConnect, setShowConnect] = useState(false)
  const [jobberOauthLoading, setJobberOauthLoading] = useState(false)
  const [marketplaceKickstartDone, setMarketplaceKickstartDone] = useState(false)
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

  const startJobberOAuth = useCallback(async () => {
    setJobberOauthLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) {
        notifyError('Select a workspace (organization) before connecting Jobber.')
        setJobberOauthLoading(false)
        return false
      }
      markJobberMarketplaceOAuthStarted()
      const { authorization_url } = await api.oauth.jobberStart(token)
      window.location.assign(authorization_url)
      return true
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start Jobber connection')
      setJobberOauthLoading(false)
      return false
    }
  }, [getFreshToken])

  useEffect(() => {
    const jobber = searchParams.get('jobber_oauth')
    if (!jobber) return
    const msg = searchParams.get('message')
    if (jobber === 'success') {
      clearJobberMarketplaceOAuthGuard()
      notifySuccess('Jobber connected.')
      refetchTenant()
      refetch()
    } else if (jobber === 'error') {
      notifyError(msg || 'Jobber connection failed.')
    }
    router.replace('/integrations')
  }, [searchParams, router, refetchTenant, refetch])

  useEffect(() => {
    if (loading || tenantLoading || marketplaceKickstartDone) return
    if (!isJobberMarketplaceLaunch(searchParams)) return
    if (jobberMarketplaceOAuthAlreadyStarted()) {
      setMarketplaceKickstartDone(true)
      router.replace('/integrations')
      return
    }
    if (!shouldKickstartJobberOAuth(tenant ?? null, credentials)) {
      setMarketplaceKickstartDone(true)
      router.replace('/integrations')
      return
    }

    setMarketplaceKickstartDone(true)
    void (async () => {
      const started = await startJobberOAuth()
      if (!started) {
        router.replace('/integrations')
      }
    })()
  }, [
    loading,
    tenantLoading,
    marketplaceKickstartDone,
    searchParams,
    tenant,
    credentials,
    router,
    startJobberOAuth,
  ])

  const handleJobberOAuth = () => void startJobberOAuth()

  const fromJobberMarketplace = isJobberMarketplaceLaunch(searchParams)
  const showJobberConnecting =
    jobberOauthLoading ||
    (fromJobberMarketplace &&
      !marketplaceKickstartDone &&
      !jobberMarketplaceOAuthAlreadyStarted() &&
      (loading ||
        tenantLoading ||
        shouldKickstartJobberOAuth(tenant ?? null, credentials ?? null)))

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
    <PageShell>
      <JobberConnectingOverlay open={showJobberConnecting} />

      <PageHeader
        title="Integrations"
        description="Connect your field-service CRM so AI bookings land on your live schedule."
      >
        <Button color="brand" onClick={() => setShowConnect(true)} disabled={showJobberConnecting}>
          Connect
        </Button>
      </PageHeader>

      <div className="max-w-2xl">
        {loading || tenantLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-zinc-950/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : visibleCredentials.length > 0 ? (
          <ul className="space-y-3">
            {visibleCredentials.map((cred) => (
              <li key={cred.ref}>
                <IntegrationCard
                  cred={cred}
                  tenant={tenant ?? null}
                  onRemove={() => void handleDelete(cred)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="border-dashed border-zinc-300/80 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-900/40">
            <CardBody className="py-14 text-center">
              <JobberLogoFrame size="lg" className="mx-auto shadow-sm" />
              <p className="mt-4 text-base font-medium text-zinc-900 dark:text-white">
                No CRM connected yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Start with Jobber to sync visits from chat and voice into your calendar.
              </p>
              <Button className="mt-6" onClick={() => setShowConnect(true)}>
                Connect Jobber
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      <Dialog open={showConnect} onClose={setShowConnect} size="lg">
        <DialogTitle>Connect CRM</DialogTitle>
        <DialogDescription>
          Bookings use your CRM schedule — no separate calendar app.
        </DialogDescription>

        <DialogBody>
          <div className="space-y-3">
            <ConnectProviderRow
              title="Jobber"
              subtitle="OAuth sign-in · syncs jobs, clients, and visits"
              logoSrc={JOBBER_LOGO}
              accent="bg-lime-500/15 text-lime-700 ring-lime-500/25 dark:text-lime-300"
              badge="Available"
              badgeColor="lime"
              loading={jobberOauthLoading}
              onClick={() => void handleJobberOAuth()}
            />
            <ConnectProviderRow
              title="Housecall Pro"
              subtitle="Coming soon"
              letter="H"
              accent="bg-amber-500/10 text-amber-700/80 ring-amber-500/15 dark:text-amber-400/80"
              badge="Soon"
              badgeColor="zinc"
              disabled
              onClick={() => notifyError('Housecall Pro is not available yet.')}
            />
          </div>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={() => setShowConnect(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        </div>
      }
    >
      <IntegrationsPageInner />
    </Suspense>
  )
}

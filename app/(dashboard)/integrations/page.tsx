'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { Heading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
import { Card, CardBody } from '@/components/card'
import { useApiData, useApiToken, useFreshOrgToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import type { Credential, Tenant } from '@/lib/types'

type ConnectStep = 'pick' | 'google-calendar'

/** Accepts a raw Google service account key JSON or { "service_account_json": { ... } }. */
function parseGoogleCalendarCredentials(raw: string): Record<string, unknown> {
  const j = JSON.parse(raw) as Record<string, unknown>
  if (j && typeof j.service_account_json === 'object' && j.service_account_json !== null) {
    return j
  }
  if (j && typeof j === 'object' && (j as { type?: string }).type === 'service_account') {
    return { service_account_json: j }
  }
  throw new Error(
    'Paste your Google service account JSON key, or an object { "service_account_json": { ... } }.',
  )
}

function integrationLabel(type: string): string {
  switch (type) {
    case 'gcal':
      return 'Google Calendar'
    case 'calcom':
      return 'Cal.com'
    case 'jobber':
      return 'Jobber CRM'
    case 'hubspot':
      return 'HubSpot CRM'
    default:
      return type
  }
}

function integrationAccent(type: string): string {
  switch (type) {
    case 'gcal':
      return 'border-l-sky-500'
    case 'calcom':
      return 'border-l-violet-500'
    case 'jobber':
      return 'border-l-lime-500'
    case 'hubspot':
      return 'border-l-amber-500'
    default:
      return 'border-l-zinc-400'
  }
}

function IntegrationCard({
  cred,
  tenant,
  onRemove,
  onManage,
}: {
  cred: Credential
  tenant: Tenant | null
  onRemove: () => void
  onManage: () => void
}) {
  const linked =
    cred.integration_type === 'gcal' &&
    tenant?.calendar_type === 'google' &&
    tenant?.calendar_credential_ref === cred.ref
  const calId =
    linked && tenant?.calendar_settings && typeof tenant.calendar_settings.calendar_id === 'string'
      ? tenant.calendar_settings.calendar_id
      : null

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
              <Badge color="sky" className="capitalize">
                {integrationLabel(cred.integration_type)}
              </Badge>
              <Badge color={cred.exists ? 'lime' : 'red'}>{cred.exists ? 'Credentials' : 'Missing'}</Badge>
              {linked && (
                <Badge color="lime" className="text-[10px]">
                  Workspace linked
                </Badge>
              )}
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
              {integrationLabel(cred.integration_type)}
            </h3>
            {calId && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Calendar: {calId}
              </p>
            )}
          </div>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Updated {formatDate(cred.updated_at)}
          </span>
        </div>

        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          {cred.integration_type === 'gcal' ? (
            <>
              Connect with Google (OAuth) or use a service account. OAuth uses your primary calendar by
              default; a service account needs the calendar shared with its email for server-side sync.
            </>
          ) : (
            <>Encrypted credentials stored for this integration.</>
          )}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-950/10 pt-4 dark:border-white/10">
          {cred.integration_type === 'gcal' && (
            <Button plain className="text-xs font-medium" onClick={onManage}>
              Manage
            </Button>
          )}
          <Button plain className="text-xs font-medium text-red-600 dark:text-red-400" onClick={onRemove}>
            Remove
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
  const [connectStep, setConnectStep] = useState<ConnectStep>('pick')
  const [gcalSaving, setGcalSaving] = useState(false)
  const [gcalRef, setGcalRef] = useState('')
  const [gcalCalendarId, setGcalCalendarId] = useState('')
  const [gcalSlotMinutes, setGcalSlotMinutes] = useState('60')
  const [gcalServiceAccountJson, setGcalServiceAccountJson] = useState('')
  const [gcalOauthLoading, setGcalOauthLoading] = useState(false)
  const getToken = useApiToken()
  const getFreshToken = useFreshOrgToken()

  const { data: tenant, loading: tenantLoading, refetch: refetchTenant } = useApiData<Tenant>(
    (token) => api.tenants.me(token),
  )

  const { data: credentials, loading, refetch } = useApiData<Credential[]>(
    (token) => api.credentials.list(token),
  )

  useEffect(() => {
    if (!tenant) return
    setGcalRef((tenant.calendar_credential_ref || `${tenant.id}_gcal`).trim())
    const cs = tenant.calendar_settings || {}
    setGcalCalendarId(typeof cs.calendar_id === 'string' ? cs.calendar_id : '')
    const slot = (cs as { slot_duration_minutes?: number }).slot_duration_minutes
    const bb = tenant.booking_buffers as { slot_duration_minutes?: number } | undefined
    setGcalSlotMinutes(
      String(
        typeof slot === 'number' && slot > 0
          ? slot
          : typeof bb?.slot_duration_minutes === 'number'
            ? bb.slot_duration_minutes
            : 60,
      ),
    )
  }, [tenant])

  useEffect(() => {
    const gcal = searchParams.get('gcal_oauth')
    if (!gcal) return
    const msg = searchParams.get('message')
    if (gcal === 'success') {
      notifySuccess('Google Calendar connected.')
      refetchTenant()
      refetch()
    } else if (gcal === 'error') {
      notifyError(msg || 'Google connection failed.')
    }
    router.replace('/integrations')
  }, [searchParams, router, refetchTenant, refetch])

  const handleGoogleCalendarOAuth = async () => {
    setGcalOauthLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) {
        notifyError('Select a workspace (organization) before connecting Google Calendar.')
        setGcalOauthLoading(false)
        return
      }
      const { authorization_url } = await api.oauth.googleCalendarStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start Google connection')
      setGcalOauthLoading(false)
    }
  }

  const openConnectModal = () => {
    setConnectStep('pick')
    setGcalServiceAccountJson('')
    setShowConnect(true)
  }

  const openGoogleCalendarStep = () => {
    setConnectStep('google-calendar')
    setGcalServiceAccountJson('')
  }

  const handleSaveGoogleCalendar = async () => {
    if (!tenant) return
    const calId = gcalCalendarId.trim()
    if (!calId) {
      notifyError('Calendar ID is required (use primary or your shared calendar ID).')
      return
    }
    setGcalSaving(true)
    try {
      const token = await getToken()
      const ref = (gcalRef.trim() || `${tenant.id}_gcal`).trim()
      const credPayload = gcalServiceAccountJson.trim()
        ? parseGoogleCalendarCredentials(gcalServiceAccountJson)
        : null

      if (!credPayload) {
        const row = credentials?.find((c) => c.ref === ref)
        if (!row?.exists) {
          notifyError('Paste your Google service account JSON, or use Sign in with Google first.')
          return
        }
      }

      if (credPayload) {
        const existing = credentials?.find((c) => c.ref === ref)
        if (existing) {
          await api.credentials.rotate(token, ref, credPayload)
        } else {
          await api.credentials.store(token, {
            ref,
            integration_type: 'gcal',
            credentials: credPayload,
          })
        }
      }

      const slotM = parseInt(gcalSlotMinutes, 10)
      await api.tenants.update(token, {
        calendar_type: 'google',
        calendar_credential_ref: ref,
        calendar_settings: {
          ...(tenant.calendar_settings || {}),
          calendar_id: calId,
          slot_duration_minutes: Number.isFinite(slotM) && slotM > 0 ? slotM : 60,
        },
      })
      notifySuccess('Google Calendar connected')
      setGcalServiceAccountJson('')
      setShowConnect(false)
      setConnectStep('pick')
      refetchTenant()
      refetch()
    } catch (e) {
      if (e instanceof SyntaxError) {
        notifyError('Invalid JSON in service account field')
      } else {
        notifyError(e instanceof ApiError ? e.message : String(e))
      }
    } finally {
      setGcalSaving(false)
    }
  }

  const handleDelete = async (ref: string) => {
    try {
      const token = await getToken()
      await api.credentials.remove(token, ref)
      if (tenant?.calendar_credential_ref === ref && tenant.calendar_type === 'google') {
        await api.tenants.update(token, {
          calendar_type: 'none',
          calendar_credential_ref: '',
        })
        refetchTenant()
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
            Connect calendars and CRMs. Google Calendar: sign in with Google (OAuth) or use an advanced
            service-account setup.
          </Text>
        </div>
        <Button onClick={openConnectModal}>Add integration</Button>
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
        ) : credentials && credentials.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {credentials.map((cred) => (
              <IntegrationCard
                key={cred.ref}
                cred={cred}
                tenant={tenant ?? null}
                onRemove={() => void handleDelete(cred.ref)}
                onManage={() => {
                  openConnectModal()
                  setConnectStep('google-calendar')
                }}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="py-12 text-center">
              <Text>No integrations yet</Text>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                Add Google Calendar to sync bookings with your workspace calendar, or connect other providers
                when available.
              </p>
              <Button className="mt-6" onClick={openConnectModal}>
                Add integration
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      <Dialog open={showConnect} onClose={setShowConnect} size="5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>
              {connectStep === 'pick' ? 'Connect integration' : 'Google Calendar'}
            </DialogTitle>
            <DialogDescription>
              {connectStep === 'pick'
                ? 'Choose a provider. Only Google Calendar is available today; others are planned.'
                : 'If you used Sign in with Google, you can adjust calendar ID and timezone here. Or paste a service account JSON key for the manual integration path.'}
            </DialogDescription>
          </div>
          {connectStep === 'google-calendar' && (
            <Button plain className="shrink-0 text-sm" onClick={() => setConnectStep('pick')}>
              ← Back
            </Button>
          )}
        </div>

        <DialogBody className="max-h-[70vh] overflow-y-auto pr-1">
          {connectStep === 'pick' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div
                className={clsx(
                  'rounded-2xl bg-zinc-100/90 p-4 dark:bg-zinc-800/50',
                  'ring-1 ring-zinc-950/5 dark:ring-white/10',
                )}
              >
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Calendars
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGoogleCalendarOAuth()}
                    disabled={gcalOauthLoading}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 disabled:opacity-60 dark:bg-zinc-900 dark:ring-white/10 dark:hover:bg-zinc-800"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg shadow ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-white/10">
                      <span className="font-bold text-blue-600">G</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white">Google Calendar</p>
                      <p className="text-xs text-zinc-500">Sign in with Google · OAuth</p>
                    </div>
                    <Badge color="lime" className="shrink-0">
                      {gcalOauthLoading ? '…' : 'Live'}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={openGoogleCalendarStep}
                    className="flex items-center gap-3 rounded-xl bg-white/90 px-4 py-3 text-left text-sm shadow-sm ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 dark:bg-zinc-900/90 dark:ring-white/10 dark:hover:bg-zinc-800"
                  >
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Advanced: service account (JSON)
                    </span>
                    <Badge color="zinc" className="ml-auto shrink-0 text-[10px]">
                      Manual
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyError('Cal.com is not available yet.')}
                    className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900/80 dark:ring-white/10"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
                      C
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-600 dark:text-zinc-400">Cal.com</p>
                      <p className="text-xs text-zinc-400">API scheduling</p>
                    </div>
                    <Badge color="zinc" className="shrink-0 text-[10px]">
                      Soon
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyError('Microsoft Outlook calendar is not available yet.')}
                    className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900/80 dark:ring-white/10"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600">
                      O
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-600 dark:text-zinc-400">Microsoft Outlook</p>
                      <p className="text-xs text-zinc-400">Calendar</p>
                    </div>
                    <Badge color="zinc" className="shrink-0 text-[10px]">
                      Soon
                    </Badge>
                  </button>
                </div>
              </div>

              <div
                className={clsx(
                  'rounded-2xl bg-zinc-100/90 p-4 dark:bg-zinc-800/50',
                  'ring-1 ring-zinc-950/5 dark:ring-white/10',
                )}
              >
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  CRM (coming soon)
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => notifyError('HubSpot integration is not available yet.')}
                    className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-3 text-left text-sm shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900/80 dark:ring-white/10"
                  >
                    <span className="text-amber-600">HubSpot</span>
                    <Badge color="zinc" className="ml-auto text-[10px]">
                      Soon
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyError('Jobber integration is not available yet.')}
                    className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-3 text-left text-sm shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900/80 dark:ring-white/10"
                  >
                    <span className="text-lime-700">Jobber</span>
                    <Badge color="zinc" className="ml-auto text-[10px]">
                      Soon
                    </Badge>
                  </button>
                </div>
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  OAuth is best when each user links their own Google account; service accounts fit
                  unattended server workflows (
                  <a
                    href="https://developers.google.com/workspace/calendar/api/auth"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-600 underline dark:text-sky-400"
                  >
                    Google Calendar auth overview
                  </a>
                  ).
                </p>
              </div>
            </div>
          ) : (
            <FieldGroup>
              <Field>
                <Label>Credential reference</Label>
                <Description>Stored encrypted; default is your org id + _gcal.</Description>
                <Input
                  value={gcalRef}
                  onChange={(e) => setGcalRef(e.target.value)}
                  placeholder="org_xxx_gcal"
                />
              </Field>
              <Field>
                <Label>Calendar ID</Label>
                <Description>
                  Use <code className="text-xs">primary</code> or the calendar ID from Google Calendar →
                  Settings → Integrate calendar.
                </Description>
                <Input
                  value={gcalCalendarId}
                  onChange={(e) => setGcalCalendarId(e.target.value)}
                  placeholder="primary"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Event duration (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    value={gcalSlotMinutes}
                    onChange={(e) => setGcalSlotMinutes(e.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <Label>Service account JSON key</Label>
                <Description>
                  Required for the service-account path. Leave empty if you connected with Google sign-in or
                  to update only calendar ID when credentials already exist.
                </Description>
                <Textarea
                  rows={8}
                  value={gcalServiceAccountJson}
                  onChange={(e) => setGcalServiceAccountJson(e.target.value)}
                  placeholder="{ ... }"
                  className="font-mono text-xs"
                />
              </Field>
            </FieldGroup>
          )}
        </DialogBody>

        <DialogActions>
          <Button plain onClick={() => setShowConnect(false)}>
            Close
          </Button>
          {connectStep === 'google-calendar' && (
            <Button onClick={() => void handleSaveGoogleCalendar()} disabled={gcalSaving}>
              {gcalSaving ? 'Saving…' : 'Save & connect'}
            </Button>
          )}
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

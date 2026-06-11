'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  LockClosedIcon,
  NoSymbolIcon,
  UserCircleIcon,
} from '@heroicons/react/20/solid'

import { Button } from '@/components/button'
import { Select } from '@/components/select'
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog'
import { VerifyIdentityDialog } from '@/components/admin/verify-identity-dialog'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import {
  StatusBadge,
  UsageBar,
  formatDate,
  formatDateTime,
  priceLabel,
} from '@/components/admin/shared'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api, ApiError } from '@/lib/api'
import { clearVerificationToken, getVerificationToken } from '@/lib/admin-verification'
import { useApiData, useApiToken, usePlans } from '@/lib/hooks'
import type { AdminTenantProfile } from '@/lib/types'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  facebook: 'Facebook',
  web: 'Web chat',
  voice: 'Voice',
}

export default function AdminClientDetailPage() {
  const params = useParams<{ id: string }>()
  const tenantId = decodeURIComponent(params.id)
  const router = useRouter()
  const getToken = useApiToken()
  const { data: plans } = usePlans()

  const {
    data: tenant,
    loading,
    error,
    refetch,
  } = useApiData((token) => api.admin.getTenant(token, tenantId), [tenantId])

  // ----- status & plan confirmation state -----
  const [confirmStatus, setConfirmStatus] = useState<'activate' | 'suspend' | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  // ----- profile (step-up verified) state -----
  const [profile, setProfile] = useState<AdminTenantProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showVerifyForProfile, setShowVerifyForProfile] = useState(false)

  // ----- danger zone state -----
  const [showVerifyForDelete, setShowVerifyForDelete] = useState(false)
  const [deleteToken, setDeleteToken] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const runStatusChange = useCallback(
    async (action: 'activate' | 'suspend') => {
      const token = await getToken()
      try {
        if (action === 'activate') {
          await api.admin.activate(token, tenantId)
          toast.success(`${tenant?.name ?? 'Client'} activated.`)
        } else {
          await api.admin.suspend(token, tenantId)
          toast.success(`${tenant?.name ?? 'Client'} suspended.`)
        }
        await refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Action failed.')
      }
    },
    [getToken, tenantId, tenant?.name, refetch],
  )

  const runAssignPlan = useCallback(
    async (planId: string) => {
      const token = await getToken()
      try {
        await api.admin.assignPlan(token, tenantId, planId)
        toast.success('Plan updated.')
        await refetch()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Plan change failed.')
      }
    },
    [getToken, tenantId, refetch],
  )

  const fetchProfile = useCallback(
    async (verificationToken: string) => {
      setProfileLoading(true)
      try {
        const token = await getToken()
        const data = await api.admin.tenantProfile(token, tenantId, verificationToken)
        setProfile(data)
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          // Token expired server-side — clear cache and re-prompt.
          clearVerificationToken()
          setShowVerifyForProfile(true)
        } else {
          toast.error(err instanceof ApiError ? err.message : 'Failed to load profile.')
        }
      } finally {
        setProfileLoading(false)
      }
    },
    [getToken, tenantId],
  )

  const handleViewProfile = useCallback(() => {
    const cached = getVerificationToken()
    if (cached) {
      void fetchProfile(cached)
    } else {
      setShowVerifyForProfile(true)
    }
  }, [fetchProfile])

  const handleDelete = useCallback(async () => {
    if (!deleteToken) return
    setDeleting(true)
    try {
      const token = await getToken()
      const result = await api.admin.deleteTenant(token, tenantId, deleteToken)
      toast.success(result.detail)
      router.push('/admin/clients')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        clearVerificationToken()
        setDeleteToken(null)
        toast.error('Verification expired. Please verify your identity again.')
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Deletion failed.')
      }
      setDeleting(false)
    }
  }, [deleteToken, getToken, tenantId, router])

  if (loading) {
    return (
      <PageShell>
        <SkeletonBlock className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonBlock className="h-56" />
          <SkeletonBlock className="h-56" />
        </div>
        <SkeletonBlock className="h-40" />
      </PageShell>
    )
  }

  if (error || !tenant) {
    return (
      <PageShell>
        <BackLink />
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
          {error ?? 'Client not found.'}
        </div>
      </PageShell>
    )
  }

  const currentPlanName = tenant.plan?.name ?? 'No plan'
  const pendingPlan = plans?.find((p) => p.id === pendingPlanId) ?? null

  return (
    <PageShell>
      {/* Header */}
      <div>
        <BackLink />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">{tenant.name}</h1>
          <StatusBadge status={tenant.account_status} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="font-mono">{tenant.id}</span> · Joined {formatDate(tenant.created_at)}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Status & plan */}
        <section className={`${dashCardClass} p-5 sm:p-6`}>
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Status & plan</h3>
          <p className="mt-0.5 text-sm text-zinc-500">
            Suspended or pending clients receive no inbound messages or calls and cannot edit
            their settings.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {tenant.account_status === 'active' ? (
              <Button color="red" onClick={() => setConfirmStatus('suspend')}>
                <NoSymbolIcon />
                Suspend client
              </Button>
            ) : (
              <Button color="green" onClick={() => setConfirmStatus('activate')}>
                <CheckCircleIcon />
                Activate client
              </Button>
            )}
          </div>

          <div className="mt-6 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
            <p className="text-sm font-medium text-zinc-950 dark:text-white">Current plan</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {tenant.plan ? (
                <>
                  {tenant.plan.name}{' '}
                  <span className="text-zinc-400">
                    · {priceLabel(tenant.plan.monthly_price_cents)} ·{' '}
                    {tenant.plan.messages_quota.toLocaleString()} msgs ·{' '}
                    {tenant.plan.call_minutes_quota.toLocaleString()} mins
                  </span>
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  No plan assigned — inbound traffic is blocked.
                </span>
              )}
            </p>
            <div className="mt-3 max-w-xs">
              <Select
                aria-label="Assign plan"
                value=""
                onChange={(e) => {
                  if (e.target.value) setPendingPlanId(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">
                  {tenant.plan ? 'Change plan…' : 'Assign a plan…'}
                </option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === tenant.plan?.id}>
                    {p.name} — {priceLabel(p.monthly_price_cents)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </section>

        {/* Usage + workspace info */}
        <div className="space-y-6">
          <section className={`${dashCardClass} p-5 sm:p-6`}>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
              Usage (rolling 30 days)
            </h3>
            <div className="mt-4 space-y-4">
              <UsageBar
                used={tenant.usage.messages_used}
                quota={tenant.usage.messages_quota}
                label="Messages"
              />
              <UsageBar
                used={tenant.usage.call_minutes_used}
                quota={tenant.usage.call_minutes_quota}
                label="Call minutes"
              />
            </div>
          </section>

          <section className={`${dashCardClass} p-5 sm:p-6`}>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Workspace</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoItem label="Timezone" value={tenant.timezone} />
              <InfoItem label="Industry" value={tenant.industry_type || '—'} />
              <InfoItem label="CRM" value={tenant.crm_type === 'none' ? '—' : tenant.crm_type} />
              <InfoItem
                label="Channels"
                value={
                  tenant.channels.length
                    ? tenant.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')
                    : 'None connected'
                }
              />
              <InfoItem label="Bookings" value={tenant.bookings_count.toLocaleString()} />
              <InfoItem label="Conversations" value={tenant.conversations_count.toLocaleString()} />
              <InfoItem label="Calls" value={tenant.calls_count.toLocaleString()} />
            </dl>
          </section>
        </div>
      </div>

      {/* Profile (step-up verified) */}
      <section className={`${dashCardClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
              <LockClosedIcon className="size-4 text-zinc-400" />
              Client profile
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500">
              Members of this client&apos;s organization — names, emails, roles, and sign-in
              activity. Requires password verification. Passwords are hashed by Clerk and can
              never be viewed.
            </p>
          </div>
          {!profile && (
            <Button outline disabled={profileLoading} onClick={handleViewProfile}>
              {profileLoading ? 'Loading…' : 'View profile'}
            </Button>
          )}
        </div>

        {profile && (
          <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-800">
            {profile.members.length === 0 && (
              <li className="py-6 text-center text-sm text-zinc-500">
                No members found in this organization.
              </li>
            )}
            {profile.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-4 py-3">
                {m.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt=""
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <UserCircleIcon className="size-10 shrink-0 text-zinc-300 dark:text-zinc-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                    {`${m.first_name} ${m.last_name}`.trim() || m.email || m.user_id}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{m.email}</p>
                </div>
                <div className="hidden text-right text-xs text-zinc-500 sm:block">
                  <p className="font-medium capitalize text-zinc-700 dark:text-zinc-300">
                    {m.role.replace(/^org:/, '')}
                  </p>
                  <p>Last sign-in: {formatDateTime(m.last_sign_in_at)}</p>
                  <p>Joined: {formatDate(m.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 sm:p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h3 className="text-base font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
        <p className="mt-0.5 text-sm text-red-600/80 dark:text-red-300/80">
          Removing a client permanently deletes their organization, login access, and ALL their
          data — bookings, conversations, calls, settings, everything. This cannot be undone.
        </p>
        <div className="mt-4">
          <Button
            color="red"
            disabled={deleting}
            onClick={() => {
              const cached = getVerificationToken()
              if (cached) {
                setDeleteToken(cached)
              } else {
                setShowVerifyForDelete(true)
              }
            }}
          >
            Remove client…
          </Button>
        </div>
      </section>

      {/* ----- dialogs ----- */}

      <ConfirmActionDialog
        open={confirmStatus === 'activate'}
        onClose={() => setConfirmStatus(null)}
        title={`Activate ${tenant.name}?`}
        description="The client will start receiving inbound messages and calls (subject to their plan quota) and will be able to edit their settings."
        confirmLabel="Yes, activate"
        busyLabel="Activating…"
        color="green"
        onConfirm={() => runStatusChange('activate')}
      />

      <ConfirmActionDialog
        open={confirmStatus === 'suspend'}
        onClose={() => setConfirmStatus(null)}
        title={`Suspend ${tenant.name}?`}
        description="All inbound messages and calls will be blocked immediately and the client will see a suspended screen in their dashboard. They can still log in, but cannot use the product."
        confirmLabel="Yes, suspend"
        busyLabel="Suspending…"
        color="red"
        onConfirm={() => runStatusChange('suspend')}
      />

      <ConfirmActionDialog
        open={pendingPlanId !== null}
        onClose={() => setPendingPlanId(null)}
        title="Change plan?"
        description={`This updates the client's quota immediately.`}
        confirmLabel="Confirm plan change"
        busyLabel="Updating…"
        color="brand"
        onConfirm={async () => {
          if (pendingPlanId) await runAssignPlan(pendingPlanId)
        }}
      >
        <div className="flex items-center justify-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/60">
          <span className="font-medium text-zinc-500 line-through decoration-zinc-400">
            {currentPlanName}
          </span>
          <span className="text-zinc-400">→</span>
          <span className="font-semibold text-brand-700 dark:text-brand-400">
            {pendingPlan ? `${pendingPlan.name} (${priceLabel(pendingPlan.monthly_price_cents)})` : ''}
          </span>
        </div>
      </ConfirmActionDialog>

      <VerifyIdentityDialog
        open={showVerifyForProfile}
        onClose={() => setShowVerifyForProfile(false)}
        actionLabel="view this client's profile"
        onVerified={(token) => void fetchProfile(token)}
      />

      <VerifyIdentityDialog
        open={showVerifyForDelete}
        onClose={() => setShowVerifyForDelete(false)}
        actionLabel="remove this client"
        onVerified={(token) => setDeleteToken(token)}
      />

      <ConfirmDeleteDialog
        open={deleteToken !== null}
        onClose={() => (deleting ? null : setDeleteToken(null))}
        title={`Remove ${tenant.name}?`}
        description="This permanently deletes the client's organization, sign-in access, and every piece of their data. Type the client's name to confirm:"
        confirmText={tenant.name}
        busy={deleting}
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}

function BackLink() {
  return (
    <Link
      href="/admin/clients"
      className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
    >
      <ArrowLeftIcon className="size-4" />
      All clients
    </Link>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-zinc-700 dark:text-zinc-200">{value}</dd>
    </div>
  )
}

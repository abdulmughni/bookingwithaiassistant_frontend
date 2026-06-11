'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  NoSymbolIcon,
  PhoneIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

import { Badge } from '@/components/badge'
import { Button } from '@/components/button'
import { Select } from '@/components/select'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Field, FieldGroup, Label } from '@/components/fieldset'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog'
import { ClientLoginDialog } from '@/components/admin/client-login-dialog'
import { VerifyIdentityDialog } from '@/components/admin/verify-identity-dialog'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import {
  StatusBadge,
  UsageBar,
  formatDate,
  formatDateTime,
  formatIndustryLabel,
  priceLabel,
  validityLabel,
} from '@/components/admin/shared'
import { PageShell, SkeletonBlock, dashCardClass } from '@/components/dashboard-ui'
import { api, ApiError } from '@/lib/api'
import { clearVerificationToken, getVerificationToken } from '@/lib/admin-verification'
import { useApiData, useApiToken, usePlans } from '@/lib/hooks'
import type { AdminOrgMember, ClientLoginCredentials, QuotaState } from '@/lib/types'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  facebook: 'Facebook',
  web: 'Web chat',
  voice: 'Voice',
}

const QUOTA_BADGE: Record<QuotaState, { label: string; color: 'green' | 'amber' | 'red' | 'zinc' }> = {
  ok: { label: 'Healthy', color: 'green' },
  warning: { label: 'Running low', color: 'amber' },
  over: { label: 'Exhausted', color: 'red' },
  expired: { label: 'Expired', color: 'red' },
  blocked: { label: 'Blocked', color: 'red' },
  no_plan: { label: 'No plan', color: 'zinc' },
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

  const [confirmStatus, setConfirmStatus] = useState<'activate' | 'suspend' | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [showAddCredits, setShowAddCredits] = useState(false)
  const [creditMessages, setCreditMessages] = useState('')
  const [creditMinutes, setCreditMinutes] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [savingCredits, setSavingCredits] = useState(false)
  const [fetchingLogin, setFetchingLogin] = useState(false)
  const [showVerifyForLogin, setShowVerifyForLogin] = useState(false)
  const [clientCredentials, setClientCredentials] = useState<ClientLoginCredentials | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
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

  const submitCredits = useCallback(async () => {
    const messages = Number.parseInt(creditMessages || '0', 10) || 0
    const minutes = Number.parseInt(creditMinutes || '0', 10) || 0
    if (messages === 0 && minutes === 0) {
      toast.error('Enter a non-zero amount of messages or minutes.')
      return
    }
    setSavingCredits(true)
    try {
      const token = await getToken()
      await api.admin.addCredits(token, tenantId, {
        messages_delta: messages,
        call_minutes_delta: minutes,
        reason: creditReason,
      })
      toast.success('Credits added.')
      setShowAddCredits(false)
      setCreditMessages('')
      setCreditMinutes('')
      setCreditReason('')
      await refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add credits.')
    } finally {
      setSavingCredits(false)
    }
  }, [creditMessages, creditMinutes, creditReason, getToken, tenantId, refetch])

  const fetchClientLogin = useCallback(
    async (verificationToken: string) => {
      setFetchingLogin(true)
      try {
        const token = await getToken()
        const credentials = await api.admin.getClientLogin(token, tenantId, verificationToken)
        setClientCredentials(credentials)
        setShowLoginDialog(true)
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          clearVerificationToken()
          setShowVerifyForLogin(true)
        } else {
          toast.error(err instanceof ApiError ? err.message : 'Could not retrieve client login.')
        }
      } finally {
        setFetchingLogin(false)
      }
    },
    [getToken, tenantId],
  )

  const handleGetClientLogin = useCallback(() => {
    clearVerificationToken()
    setShowVerifyForLogin(true)
  }, [])

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
        <SkeletonBlock className="h-36" />
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonBlock className="h-64 lg:col-span-2" />
          <SkeletonBlock className="h-64" />
        </div>
        <SkeletonBlock className="h-48" />
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
  const quotaBadge = QUOTA_BADGE[tenant.usage.quota_state] ?? QUOTA_BADGE.no_plan
  const members = tenant.members ?? []
  const recentAdjustments = tenant.recent_adjustments ?? []
  const channels = tenant.channels ?? []

  return (
    <PageShell>
      <BackLink />

      {/* Hero */}
      <header className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-6 text-zinc-950 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-50 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{tenant.name}</h1>
              <StatusBadge status={tenant.account_status} />
            </div>
            <p className="mt-2 font-mono text-sm text-zinc-500 dark:text-zinc-400">{tenant.id}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Joined {formatDate(tenant.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tenant.account_status === 'active' ? (
              <Button color="red" onClick={() => setConfirmStatus('suspend')}>
                <NoSymbolIcon />
                Suspend
              </Button>
            ) : (
              <Button color="green" onClick={() => setConfirmStatus('activate')}>
                <CheckCircleIcon />
                Activate
              </Button>
            )}
            <Button outline disabled={fetchingLogin} onClick={handleGetClientLogin}>
              <ArrowTopRightOnSquareIcon />
              {fetchingLogin ? 'Loading…' : 'Client login credentials'}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <HeroStat icon={<CalendarDaysIcon className="size-5" />} label="Bookings" value={tenant.bookings_count} />
          <HeroStat
            icon={<ChatBubbleLeftRightIcon className="size-5" />}
            label="Conversations"
            value={tenant.conversations_count}
          />
          <HeroStat icon={<PhoneIcon className="size-5" />} label="Calls" value={tenant.calls_count} />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Plan + credits — primary column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Prepaid plan card */}
          <section className={`${dashCardClass} overflow-hidden`}>
            <div className="border-b border-zinc-200/80 bg-zinc-50/80 px-5 py-4 dark:border-zinc-700/80 dark:bg-zinc-800/40 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="size-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Credit pack</h2>
                </div>
                <Badge color={quotaBadge.color}>{quotaBadge.label}</Badge>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {tenant.plan ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-2xl font-bold text-zinc-950 dark:text-white">{tenant.plan.name}</p>
                    <p className="mt-1 text-lg font-semibold text-brand-700 dark:text-brand-400">
                      {priceLabel(tenant.plan.monthly_price_cents)}
                      <span className="ml-1 text-sm font-normal text-zinc-500">one-time pack</span>
                    </p>
                    <div className="mt-4 space-y-2 text-sm">
                      <PlanAllowanceRow
                        label="Messages included"
                        value={tenant.plan.messages_quota.toLocaleString()}
                      />
                      <PlanAllowanceRow
                        label="Call minutes included"
                        value={tenant.plan.call_minutes_quota.toLocaleString()}
                      />
                      <PlanAllowanceRow
                        label="Validity"
                        value={validityLabel(tenant.plan.validity_days)}
                      />
                    </div>
                  </div>

                  <div
                    className={clsx(
                      'rounded-xl border p-4',
                      tenant.is_expired
                        ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
                        : 'border-brand-200/80 bg-brand-50/50 dark:border-brand-800/40 dark:bg-brand-950/20',
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ClockIcon
                        className={clsx(
                          'size-4',
                          tenant.is_expired ? 'text-red-600' : 'text-brand-600 dark:text-brand-400',
                        )}
                      />
                      {tenant.is_expired ? 'Pack expired' : 'Credits valid until'}
                    </div>
                    <p
                      className={clsx(
                        'mt-1 text-lg font-semibold',
                        tenant.is_expired
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-zinc-900 dark:text-white',
                      )}
                    >
                      {formatDate(tenant.subscription_expires_at)}
                    </p>
                    {tenant.is_expired && (
                      <p className="mt-2 text-xs text-red-600/90 dark:text-red-300/90">
                        Inbound traffic is blocked until you assign or renew a plan.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/80 px-4 py-6 text-center dark:border-amber-800/60 dark:bg-amber-950/20">
                  <p className="font-medium text-amber-800 dark:text-amber-200">No plan assigned</p>
                  <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
                    This client cannot receive messages or calls until you assign a credit pack.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
                <div className="min-w-48 flex-1 max-w-xs">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {tenant.plan ? 'Change plan' : 'Assign plan'}
                  </label>
                  <Select
                    aria-label="Assign plan"
                    value={pendingPlanId ?? tenant.plan?.id ?? ''}
                    onChange={(e) => {
                      const nextId = e.target.value
                      if (!nextId) return
                      if (nextId !== tenant.plan?.id) {
                        setPendingPlanId(nextId)
                      } else {
                        setPendingPlanId(null)
                      }
                    }}
                  >
                    {!tenant.plan ? (
                      <option value="" disabled>
                        Select a plan…
                      </option>
                    ) : null}
                    {plans?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {priceLabel(p.monthly_price_cents)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </section>

          {/* Usage */}
          <section className={`${dashCardClass} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Credit usage</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Consumed cumulatively over the pack&apos;s validity window.
                </p>
              </div>
              <Button
                outline
                disabled={!tenant.plan}
                onClick={() => setShowAddCredits(true)}
                title={tenant.plan ? undefined : 'Assign a plan before adding credits'}
              >
                Add credits
              </Button>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
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

            {recentAdjustments.length > 0 && (
              <div className="mt-6 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Recent top-ups</p>
                <ul className="mt-3 space-y-2">
                  {recentAdjustments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {[
                            a.messages_delta
                              ? `${a.messages_delta > 0 ? '+' : ''}${a.messages_delta.toLocaleString()} msgs`
                              : null,
                            a.call_minutes_delta
                              ? `${a.call_minutes_delta > 0 ? '+' : ''}${a.call_minutes_delta.toLocaleString()} mins`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {a.reason && (
                          <span className="block truncate text-xs text-zinc-500">{a.reason}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-zinc-400">{formatDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: workspace + team */}
        <div className="space-y-6">
          <section className={`${dashCardClass} p-5 sm:p-6`}>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Workspace</h2>
            <dl className="mt-4 space-y-4">
              <WorkspaceRow label="Timezone" value={tenant.timezone} />
              <WorkspaceRow label="Industry" value={formatIndustryLabel(tenant.industry_type)} />
              <WorkspaceRow label="CRM" value={tenant.crm_type === 'none' ? '—' : tenant.crm_type} />
              <WorkspaceRow
                label="Channels"
                value={
                  channels.length
                    ? channels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')
                    : 'None connected'
                }
              />
            </dl>
          </section>

          <section className={`${dashCardClass} p-5 sm:p-6`}>
            <div className="flex items-center gap-2">
              <UsersIcon className="size-5 text-zinc-400" />
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Team</h2>
              <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {members.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Organization members — always visible here. Use &quot;Client login credentials&quot; to
              copy sign-in details for testing in a separate tab.
            </p>

            <ul className="mt-4 space-y-3">
              {members.length === 0 && (
                <li className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                  No members found in this organization.
                </li>
              )}
              {members.map((m) => (
                <MemberCard key={m.user_id || m.email} member={m} />
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 sm:p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h3 className="text-base font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
        <p className="mt-0.5 text-sm text-red-600/80 dark:text-red-300/80">
          Permanently removes the organization, login access, and all data. Cannot be undone.
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

      {/* Dialogs */}
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
        description="All inbound messages and calls will be blocked immediately. They can still log in but cannot use the product."
        confirmLabel="Yes, suspend"
        busyLabel="Suspending…"
        color="red"
        onConfirm={() => runStatusChange('suspend')}
      />

      <ConfirmActionDialog
        open={pendingPlanId !== null}
        onClose={() => setPendingPlanId(null)}
        title="Change plan?"
        description="This starts a fresh prepaid pack: it resets their credit balance and validity window to the new plan immediately."
        confirmLabel="Confirm plan change"
        busyLabel="Updating…"
        color="brand"
        onConfirm={async () => {
          if (pendingPlanId) {
            await runAssignPlan(pendingPlanId)
            setPendingPlanId(null)
          }
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

      <Dialog open={showAddCredits} onClose={() => (savingCredits ? null : setShowAddCredits(false))}>
        <DialogTitle>Add credits</DialogTitle>
        <DialogDescription>
          Top up {tenant.name}&apos;s prepaid balance. Recorded in the audit log.
        </DialogDescription>
        <DialogBody>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Messages</Label>
                <Input
                  type="number"
                  value={creditMessages}
                  onChange={(e) => setCreditMessages(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field>
                <Label>Call minutes</Label>
                <Input
                  type="number"
                  value={creditMinutes}
                  onChange={(e) => setCreditMinutes(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field>
              <Label>Reason (optional)</Label>
              <Textarea
                rows={2}
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g. goodwill credit, billing correction…"
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain disabled={savingCredits} onClick={() => setShowAddCredits(false)}>
            Cancel
          </Button>
          <Button color="brand" disabled={savingCredits} onClick={submitCredits}>
            {savingCredits ? 'Adding…' : 'Add credits'}
          </Button>
        </DialogActions>
      </Dialog>

      <VerifyIdentityDialog
        open={showVerifyForLogin}
        onClose={() => setShowVerifyForLogin(false)}
        actionLabel="view this client's login credentials"
        requireFreshVerification
        onVerified={(token) => void fetchClientLogin(token)}
      />

      <ClientLoginDialog
        open={showLoginDialog}
        onClose={() => {
          clearVerificationToken()
          setShowLoginDialog(false)
          setClientCredentials(null)
        }}
        credentials={clientCredentials}
        clientName={tenant.name}
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

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-600/80 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function PlanAllowanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums text-zinc-900 dark:text-white">{value}</span>
    </div>
  )
}

function WorkspaceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{value}</dd>
    </div>
  )
}

function MemberCard({ member }: { member: AdminOrgMember }) {
  const displayName =
    `${member.first_name} ${member.last_name}`.trim() || member.email || member.user_id

  return (
    <li className="flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-700/80 dark:bg-zinc-800/30">
      {member.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.image_url} alt="" className="size-10 shrink-0 rounded-full object-cover" />
      ) : (
        <UserCircleIcon className="size-10 shrink-0 text-zinc-300 dark:text-zinc-600" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">{displayName}</p>
        <p className="truncate text-xs text-zinc-500">{member.email || '—'}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
          <span className="capitalize text-zinc-600 dark:text-zinc-400">
            {member.role.replace(/^org:/, '')}
          </span>
          <span>Joined {formatDate(member.created_at)}</span>
          <span>Last sign-in {formatDateTime(member.last_sign_in_at)}</span>
        </div>
      </div>
    </li>
  )
}

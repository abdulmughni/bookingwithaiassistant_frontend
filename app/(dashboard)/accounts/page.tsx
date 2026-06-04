'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { Button } from '@/components/button'
import { PageHeader, PageShell } from '@/components/dashboard-ui'
import { Badge } from '@/components/badge'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Field, FieldGroup, Label } from '@/components/fieldset'
import { Card, CardBody } from '@/components/card'
import { ChannelIcon } from '@/components/channel-icon'
import { useApiData, useApiToken, useFreshOrgToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import type { ChannelAccount } from '@/lib/types'

const channelAccent: Record<string, string> = {
  whatsapp: 'border-l-emerald-500',
  facebook: 'border-l-sky-500',
  instagram: 'border-l-fuchsia-500',
  web: 'border-l-zinc-400',
}

const destinationIconFrame: Record<'facebook' | 'instagram' | 'whatsapp', string> = {
  facebook: 'border-sky-200 bg-sky-50 dark:border-sky-700/80 dark:bg-sky-950/50',
  instagram: 'border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-700/80 dark:bg-fuchsia-950/50',
  whatsapp: 'border-emerald-200 bg-emerald-50 dark:border-emerald-700/80 dark:bg-emerald-950/50',
}

function DestinationConnectCard({
  channel,
  title,
  description,
  actionLabel,
  actionClassName,
  onClick,
  disabled,
}: {
  channel: 'facebook' | 'instagram' | 'whatsapp'
  title: string
  description: string
  actionLabel: string
  actionClassName?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex h-full w-full flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-6 text-center shadow-sm transition',
        'hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
        'disabled:pointer-events-none disabled:opacity-50',
        'dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80',
      )}
    >
      <span
        className={clsx(
          'flex size-14 shrink-0 items-center justify-center rounded-2xl border',
          destinationIconFrame[channel],
        )}
      >
        <ChannelIcon channel={channel} className="h-9 w-9" colored />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <span className={clsx('text-xs font-medium', actionClassName ?? 'text-zinc-600 dark:text-zinc-300')}>
        {actionLabel}
      </span>
    </button>
  )
}

function connectionBadgeColor(status: string): 'lime' | 'red' | 'amber' {
  if (status === 'verified') return 'lime'
  if (status === 'error') return 'red'
  return 'amber'
}

function ChannelAvatar({ ch }: { ch: ChannelAccount }) {
  // Meta CDN URLs occasionally fail (expired tokens, referrer policy). When the
  // <img> errors we swap to the brand-icon fallback so the card never breaks.
  const [pictureFailed, setPictureFailed] = useState(false)
  const showPicture = Boolean(ch.picture_url) && !pictureFailed
  return (
    <div className="relative shrink-0">
      {showPicture ? (
        // eslint-disable-next-line @next/next/no-img-element -- Meta CDN profile URLs (domain varies per account)
        <img
          src={ch.picture_url || ''}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setPictureFailed(true)}
          className="size-12 rounded-full object-cover shadow-sm ring-2 ring-zinc-950/5 dark:ring-white/10"
        />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-full bg-zinc-100 shadow-sm ring-2 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <ChannelIcon channel={ch.channel} className="h-7 w-7" colored />
        </div>
      )}
      {showPicture && (
        <div
          className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-600"
          title={ch.channel}
        >
          <ChannelIcon channel={ch.channel} className="h-3.5 w-3.5" colored />
        </div>
      )}
    </div>
  )
}

function ChannelAccountCard({
  ch,
  verifying,
  onVerify,
  onToggle,
  onDelete,
}: {
  ch: ChannelAccount
  verifying: boolean
  onVerify: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const accent = channelAccent[ch.channel] ?? channelAccent.web
  const conn = ch.connection_status

  return (
    <Card
      className={clsx(
        'flex flex-col border border-zinc-200/80 border-l-4 bg-white pl-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:hover:border-zinc-600 sm:pl-5',
        accent,
      )}
    >
      <CardBody className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <ChannelAvatar ch={ch} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={ch.is_active ? 'lime' : 'zinc'}>
                  {ch.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <h3 className="mt-3 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
                {ch.label || 'Unnamed account'}
              </h3>
              <p className="mt-1 text-xs capitalize text-zinc-500 dark:text-zinc-400">{ch.channel}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <Badge color={connectionBadgeColor(conn)}>
              {conn === 'verified' ? 'Connected' : conn === 'error' ? 'Error' : 'Pending'}
            </Badge>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {ch.last_verified_at ? formatDate(ch.last_verified_at) : 'Never verified'}
            </span>
          </div>
        </div>

        {ch.connection_message && (
          <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
            {ch.connection_message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-950/10 pt-4 dark:border-white/10">
          <Button
            plain
            className="text-xs font-medium"
            onClick={onVerify}
            disabled={verifying}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </Button>
          <Button plain className="text-xs font-medium" onClick={onToggle}>
            {ch.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button plain className="text-xs font-medium text-red-600 dark:text-red-400" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function AccountsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showConnect, setShowConnect] = useState(false)
  const [connectMode, setConnectMode] = useState<'destination' | 'manual'>('destination')
  const [newChannel, setNewChannel] = useState('whatsapp')
  const [newAccountId, setNewAccountId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newVerifyToken, setNewVerifyToken] = useState('')
  const [newAccessToken, setNewAccessToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null)
  const getToken = useApiToken()
  const getFreshToken = useFreshOrgToken()

  const { data: channels, loading, refetch } = useApiData<ChannelAccount[]>(
    (token) => api.channels.list(token),
  )

  useEffect(() => {
    const fb = searchParams.get('fb_oauth')
    const wa = searchParams.get('wa_oauth')
    const ig = searchParams.get('ig_oauth')
    if (!fb && !wa && !ig) return
    const msg = searchParams.get('message')
    const formatMetaSuccess = () => {
      const pages = Number(searchParams.get('pages') || '0')
      const instagram = Number(searchParams.get('instagram') || searchParams.get('accounts') || '0')
      const parts: string[] = []
      if (pages > 0) parts.push(`${pages} Facebook page${pages === 1 ? '' : 's'}`)
      if (instagram > 0)
        parts.push(`${instagram} Instagram account${instagram === 1 ? '' : 's'}`)
      if (parts.length === 0) return 'Meta connection completed.'
      return `Meta connected — ${parts.join(' + ')} added.`
    }
    if (fb === 'success' || ig === 'success') {
      notifySuccess(formatMetaSuccess())
      refetch()
    } else if (fb === 'error') {
      notifyError(msg || 'Facebook connection failed.')
    } else if (ig === 'error') {
      notifyError(msg || 'Instagram connection failed.')
    }
    if (wa === 'success') {
      const n = searchParams.get('numbers')
      notifySuccess(
        n ? `WhatsApp connected — ${n} number(s) added.` : 'WhatsApp connected successfully.',
      )
      refetch()
    } else if (wa === 'error') {
      notifyError(msg || 'WhatsApp connection failed.')
    }
    router.replace('/accounts')
  }, [searchParams, router, refetch])

  const handleMetaOAuth = async () => {
    setOauthLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) {
        notifyError('Select a workspace (organization) before connecting Facebook & Instagram.')
        setOauthLoading(false)
        return
      }
      const { authorization_url } = await api.oauth.facebookStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(
        e instanceof ApiError ? e.message : 'Could not start Facebook & Instagram connection',
      )
      setOauthLoading(false)
    }
  }

  const handleWhatsAppOAuth = async () => {
    setOauthLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) {
        notifyError('Select a workspace (organization) before connecting WhatsApp.')
        setOauthLoading(false)
        return
      }
      const { authorization_url } = await api.oauth.whatsappStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start WhatsApp connection')
      setOauthLoading(false)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      const meta: Record<string, unknown> = {}
      if (newChannel === 'whatsapp') {
        meta.phone_number_id = newAccountId
        if (newAccessToken.trim()) meta.access_token = newAccessToken.trim()
      } else if (newChannel === 'facebook' || newChannel === 'instagram') {
        const raw = newAccountId.replace(/^page_/i, '').replace(/^ig_/i, '')
        if (newChannel === 'facebook') meta.page_id = raw
        if (newAccessToken.trim()) meta.access_token = newAccessToken.trim()
      }

      await api.channels.create(token, {
        channel: newChannel,
        account_id: newAccountId,
        label: newLabel,
        verify_token: newVerifyToken || undefined,
        meta,
      })
      notifySuccess('Channel account created as pending. Click Verify connection.')
      setShowConnect(false)
      setConnectMode('destination')
      setNewAccountId('')
      setNewLabel('')
      setNewVerifyToken('')
      setNewAccessToken('')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not create channel account')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (ch: ChannelAccount) => {
    try {
      const token = await getToken()
      if (ch.is_active) {
        await api.channels.deactivate(token, ch.channel, ch.account_id)
        notifySuccess('Channel deactivated')
      } else {
        await api.channels.activate(token, ch.channel, ch.account_id)
        notifySuccess('Channel activated')
      }
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not update channel')
    }
  }

  const handleDelete = async (ch: ChannelAccount) => {
    try {
      const token = await getToken()
      await api.channels.remove(token, ch.channel, ch.account_id)
      notifySuccess('Channel removed')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not delete channel')
    }
  }

  const handleVerify = async (ch: ChannelAccount) => {
    const key = `${ch.channel}-${ch.account_id}`
    setVerifyingKey(key)
    try {
      const token = await getToken()
      const result = await api.channels.verify(token, ch.channel, ch.account_id)
      if (result.connection_status === 'verified') {
        notifySuccess('Connection verified successfully')
      } else if (result.connection_status === 'pending') {
        notifyError(result.connection_message || 'Connection is pending')
      } else {
        notifyError(result.connection_message || 'Connection verification failed')
      }
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not verify channel connection')
    } finally {
      setVerifyingKey(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Channel accounts"
        description="Connect WhatsApp, Facebook Messenger, and Instagram so customer messages reach your dashboard."
      >
        <Button color="brand" onClick={() => {
            setConnectMode('destination')
            setShowConnect(true)
          }}>
          Add account
        </Button>
      </PageHeader>

      <div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl border border-zinc-950/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {channels.map((ch) => (
              <ChannelAccountCard
                key={`${ch.channel}-${ch.account_id}`}
                ch={ch}
                verifying={verifyingKey === `${ch.channel}-${ch.account_id}`}
                onVerify={() => handleVerify(ch)}
                onToggle={() => handleToggle(ch)}
                onDelete={() => handleDelete(ch)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="py-12 text-center">
              <Text>No channel accounts connected yet</Text>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Add an account to connect WhatsApp, Facebook, Instagram, or web chat.
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      <Dialog open={showConnect} onClose={setShowConnect} size="5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>Connect destination</DialogTitle>
            <DialogDescription>
              {connectMode === 'destination'
                ? 'Connect Facebook Messenger, Instagram, or WhatsApp so you can send and receive customer messages from one dashboard.'
                : 'Enter account details manually (advanced).'}
            </DialogDescription>
          </div>
          {connectMode === 'manual' && (
            <Button plain className="shrink-0 text-sm" onClick={() => setConnectMode('destination')}>
              ← Back
            </Button>
          )}
        </div>

        <DialogBody className="max-h-[70vh] overflow-y-auto pr-1">
          {connectMode === 'destination' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <DestinationConnectCard
                channel="facebook"
                title="Facebook"
                description="Messenger for the Facebook Pages you select during Meta sign-in."
                actionLabel={oauthLoading ? 'Redirecting…' : 'Connect with Meta'}
                actionClassName="text-blue-600 dark:text-blue-400"
                disabled={oauthLoading}
                onClick={() => void handleMetaOAuth()}
              />
              <DestinationConnectCard
                channel="instagram"
                title="Instagram"
                description="DMs for Instagram business accounts linked to those Pages — same Meta sign-in."
                actionLabel={oauthLoading ? 'Redirecting…' : 'Connect with Meta'}
                actionClassName="text-fuchsia-600 dark:text-fuchsia-400"
                disabled={oauthLoading}
                onClick={() => void handleMetaOAuth()}
              />
              <DestinationConnectCard
                channel="whatsapp"
                title="WhatsApp"
                description="Cloud API number via Meta embedded signup."
                actionLabel={oauthLoading ? 'Redirecting…' : 'Connect'}
                actionClassName="text-emerald-700 dark:text-emerald-400"
                disabled={oauthLoading}
                onClick={() => void handleWhatsAppOAuth()}
              />
            </div>
          ) : (
            <FieldGroup>
              <Field>
                <Label>Channel</Label>
                <Select value={newChannel} onChange={(e) => setNewChannel(e.target.value)}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="web">Web</option>
                </Select>
              </Field>
              <Field>
                <Label>Account ID</Label>
                <Input
                  placeholder="Phone number ID, page ID, or widget ID"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Label</Label>
                <Input placeholder="Friendly name" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              </Field>
              <Field>
                <Label>Verify Token (optional)</Label>
                <Input
                  placeholder="Webhook verify token"
                  value={newVerifyToken}
                  onChange={(e) => setNewVerifyToken(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Access Token (optional but recommended)</Label>
                <Input
                  placeholder={
                    newChannel === 'whatsapp'
                      ? 'WhatsApp access token'
                      : newChannel === 'web'
                        ? 'Not needed for web channel'
                        : 'Facebook / Instagram access token'
                  }
                  value={newAccessToken}
                  onChange={(e) => setNewAccessToken(e.target.value)}
                  disabled={newChannel === 'web'}
                />
              </Field>
            </FieldGroup>
          )}

          {connectMode === 'destination' && (
            <div className="mt-6 border-t border-zinc-950/10 pt-4 dark:border-white/10">
              <Button plain className="text-sm text-zinc-600 dark:text-zinc-400" onClick={() => setConnectMode('manual')}>
                Use manual form instead →
              </Button>
            </div>
          )}
        </DialogBody>

        <DialogActions>
          <Button plain onClick={() => setShowConnect(false)}>
            Close
          </Button>
          {connectMode === 'manual' && (
            <Button onClick={handleCreate} disabled={!newAccountId || !newLabel || saving}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageShell>
  )
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      }
    >
      <AccountsPageInner />
    </Suspense>
  )
}

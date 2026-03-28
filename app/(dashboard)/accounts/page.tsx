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
import { Select } from '@/components/select'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Field, FieldGroup, Label } from '@/components/fieldset'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table'
import { useApiData, useApiToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { channelColor, formatDate } from '@/lib/utils'
import type { ChannelAccount } from '@/lib/types'

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

  const { data: channels, loading, refetch } = useApiData<ChannelAccount[]>(
    (token) => api.channels.list(token),
  )

  useEffect(() => {
    const fb = searchParams.get('fb_oauth')
    const wa = searchParams.get('wa_oauth')
    const ig = searchParams.get('ig_oauth')
    if (!fb && !wa && !ig) return
    const msg = searchParams.get('message')
    if (fb === 'success') {
      const n = searchParams.get('pages')
      notifySuccess(
        n ? `Facebook connected — ${n} page(s) added.` : 'Facebook pages connected successfully.',
      )
      refetch()
    } else if (fb === 'error') {
      notifyError(msg || 'Facebook connection failed.')
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
    if (ig === 'success') {
      const n = searchParams.get('accounts')
      notifySuccess(
        n ? `Instagram connected — ${n} account(s) added.` : 'Instagram connected successfully.',
      )
      refetch()
    } else if (ig === 'error') {
      notifyError(msg || 'Instagram connection failed.')
    }
    router.replace('/accounts')
  }, [searchParams, router, refetch])

  const webhookBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
  const webhookUrls = {
    whatsapp: `${webhookBase}/webhooks/whatsapp`,
    facebook: `${webhookBase}/webhooks/facebook`,
    instagram: `${webhookBase}/webhooks/instagram`,
    web: `${webhookBase}/webhooks/web`,
  }

  const handleFacebookPageOAuth = async () => {
    setOauthLoading(true)
    try {
      const token = await getToken()
      const { authorization_url } = await api.oauth.facebookStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start Facebook connection')
      setOauthLoading(false)
    }
  }

  const handleWhatsAppOAuth = async () => {
    setOauthLoading(true)
    try {
      const token = await getToken()
      const { authorization_url } = await api.oauth.whatsappStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start WhatsApp connection')
      setOauthLoading(false)
    }
  }

  const handleInstagramOAuth = async () => {
    setOauthLoading(true)
    try {
      const token = await getToken()
      const { authorization_url } = await api.oauth.instagramStart(token)
      window.location.assign(authorization_url)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not start Instagram connection')
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

  const statusColor = (status: string) => {
    if (status === 'verified') return 'lime'
    if (status === 'error') return 'red'
    return 'amber'
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading>Channel Accounts</Heading>
        <Button
          onClick={() => {
            setConnectMode('destination')
            setShowConnect(true)
          }}
        >
          Add account
        </Button>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6 rounded-xl border border-zinc-950/10 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-zinc-900/40">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Setup guide before connecting</h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          Complete Meta configuration first, then use <strong>Connect Facebook Page</strong>,{' '}
          <strong>Connect Instagram</strong>, or manual entry. After saving the webhook in Meta, click{' '}
          <strong>Verify</strong> on each account if needed.
        </p>
        <div className="mt-3 space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
          <details>
            <summary className="cursor-pointer font-medium">WhatsApp Cloud API</summary>
            <div className="mt-1 space-y-1">
              <p>1) Meta App → WhatsApp product → connect business phone.</p>
              <p>2) Copy <strong>Phone Number ID</strong>.</p>
              <p>3) Webhook URL: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">{webhookUrls.whatsapp}</code></p>
              <p>4) Verify token = backend <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">WHATSAPP_VERIFY_TOKEN</code></p>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Facebook Messenger</summary>
            <div className="mt-1 space-y-1">
              <p>1) Messenger product → connect Page.</p>
              <p>2) Webhook URL: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">{webhookUrls.facebook}</code></p>
              <p>3) Verify token = <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">FACEBOOK_VERIFY_TOKEN</code></p>
              <p>4) Prefer <strong>Connect Facebook Page</strong> in Add account (OAuth).</p>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">Instagram &amp; Web</summary>
            <div className="mt-1 space-y-1">
              <p>1) Link an Instagram Business account to a Facebook Page in Meta Business Suite.</p>
              <p>2) Instagram product → webhook URL: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">{webhookUrls.instagram}</code></p>
              <p>3) Verify token = <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">INSTAGRAM_VERIFY_TOKEN</code> or <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">FACEBOOK_VERIFY_TOKEN</code></p>
              <p>4) Prefer <strong>Connect Instagram</strong> in Add account (OAuth).</p>
              <p>Web: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">{webhookUrls.web}</code></p>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : channels && channels.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Channel</TableHeader>
                <TableHeader>Account ID</TableHeader>
                <TableHeader>Label</TableHeader>
                <TableHeader>Connection</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Verified</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((ch) => (
                <TableRow key={`${ch.channel}-${ch.account_id}`}>
                  <TableCell>
                    <Badge color={channelColor(ch.channel)}>{ch.channel}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{ch.account_id}</TableCell>
                  <TableCell className="font-medium">{ch.label}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge color={statusColor(ch.connection_status)}>
                        {ch.connection_status === 'verified'
                          ? 'Connected'
                          : ch.connection_status === 'error'
                            ? 'Error'
                            : 'Pending'}
                      </Badge>
                      {ch.connection_message && (
                        <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                          {ch.connection_message}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge color={ch.is_active ? 'lime' : 'zinc'}>
                      {ch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{ch.last_verified_at ? formatDate(ch.last_verified_at) : 'Never'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        plain
                        className="text-xs"
                        onClick={() => handleVerify(ch)}
                        disabled={verifyingKey === `${ch.channel}-${ch.account_id}`}
                      >
                        {verifyingKey === `${ch.channel}-${ch.account_id}` ? 'Verifying...' : 'Verify'}
                      </Button>
                      <Button plain className="text-xs" onClick={() => handleToggle(ch)}>
                        {ch.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button plain className="text-xs text-red-600" onClick={() => handleDelete(ch)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Text className="py-8 text-center">No channel accounts connected yet</Text>
        )}
      </div>

      <Dialog open={showConnect} onClose={setShowConnect} size="5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>Connect destination</DialogTitle>
            <DialogDescription>
              {connectMode === 'destination'
                ? 'Choose a platform. Facebook Page uses secure login — no copying tokens by hand.'
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
            <div className="grid gap-4 lg:grid-cols-2">
              <div
                className={clsx(
                  'rounded-2xl bg-zinc-100/90 p-4 dark:bg-zinc-800/50',
                  'ring-1 ring-zinc-950/5 dark:ring-white/10',
                )}
              >
                <div className="mb-3 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
                    <span className="text-[#1877F2]">Facebook</span>
                    <span className="text-red-600">LIVE</span>
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={oauthLoading}
                    onClick={handleFacebookPageOAuth}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-left text-sm font-medium text-blue-600 shadow-sm ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-blue-400 dark:ring-white/10 dark:hover:bg-zinc-800',
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                      f
                    </span>
                    {oauthLoading ? 'Redirecting to Meta…' : 'Page'}
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyError('Group connection is not supported yet. Use a Facebook Page for now.')}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-left text-sm font-medium text-blue-600/60 shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:text-blue-400/50 dark:ring-white/10"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-500/10 text-zinc-500">
                      f
                    </span>
                    Group
                    <Badge color="zinc" className="ml-auto text-[10px]">
                      Soon
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyError('Profile connection is not supported yet. Use a Facebook Page for now.')}
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-left text-sm font-medium text-blue-600/60 shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:text-blue-400/50 dark:ring-white/10"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-500/10 text-zinc-500">
                      f
                    </span>
                    Profile
                    <Badge color="zinc" className="ml-auto text-[10px]">
                      Soon
                    </Badge>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={oauthLoading}
                  onClick={handleInstagramOAuth}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 disabled:opacity-50 dark:bg-zinc-900 dark:ring-white/10"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-white"
                    style={{
                      background: 'linear-gradient(135deg, #f58529, #dd2a7b, #8134af)',
                    }}
                  >
                    ◎
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Instagram</p>
                    <p className="text-xs text-zinc-500">
                      {oauthLoading ? 'Redirecting to Meta…' : 'Business account linked to a Page'}
                    </p>
                  </div>
                  <Badge color="lime" className="ml-auto">
                    Live
                  </Badge>
                </button>
                <button
                  type="button"
                  disabled={oauthLoading}
                  onClick={handleWhatsAppOAuth}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-4 text-left shadow-sm ring-1 ring-zinc-950/10 disabled:opacity-50 dark:bg-zinc-900 dark:ring-white/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366] text-lg text-white">
                    ✓
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">WhatsApp</p>
                    <p className="text-xs text-zinc-500">
                      {oauthLoading ? 'Redirecting to Meta...' : 'Embedded signup'}
                    </p>
                  </div>
                  <Badge color="lime" className="ml-auto">
                    Live
                  </Badge>
                </button>
              </div>
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
    </>
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

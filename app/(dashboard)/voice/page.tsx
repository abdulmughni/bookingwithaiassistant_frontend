'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BoltIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  PhoneIcon,
  SparklesIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/20/solid'
import { Heading, Subheading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { Card, CardBody } from '@/components/card'
import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
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
import { formatDateTime } from '@/lib/utils'
import type {
  VoiceConfig,
  VoicePhoneNumber,
  VoiceSettings,
  VoiceTool,
  VoiceToolsResponse,
} from '@/lib/types'

type FormState = Pick<
  VoiceSettings,
  'system_prompt' | 'first_message' | 'model_provider' | 'model_name'
> & {
  voice_provider: string
  voice_id: string
  end_call_phrases: string
}

function settingsToForm(s: VoiceSettings, defaults: VoiceConfig['defaults']): FormState {
  return {
    system_prompt: s.system_prompt || defaults.system_prompt,
    first_message: s.first_message || defaults.first_message,
    model_provider: s.model_provider || 'openai',
    model_name: s.model_name || 'gpt-4o-mini',
    voice_provider: String((s.voice as { provider?: unknown })?.provider ?? '11labs'),
    voice_id: String((s.voice as { voiceId?: unknown })?.voiceId ?? 'rachel'),
    end_call_phrases: (s.end_call_phrases || []).join(', '),
  }
}

function formToPatch(f: FormState): Partial<VoiceSettings> {
  return {
    system_prompt: f.system_prompt,
    first_message: f.first_message,
    model_provider: f.model_provider,
    model_name: f.model_name,
    voice: { provider: f.voice_provider, voiceId: f.voice_id },
    end_call_phrases: f.end_call_phrases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

// ---------------------------------------------------------------------------
// Undo / redo state helper
// ---------------------------------------------------------------------------
//
// Behaves like `useState` but also captures snapshots so Undo/Redo buttons
// and Ctrl+Z / Ctrl+Shift+Z can revert changes — including programmatic ones
// like "Reset to default", which native <textarea> undo does not cover.
//
// Coalescing: a fresh snapshot is pushed only if more than 500 ms passed
// since the last user edit, or if the caller passes `{ force: true }` (used
// by Reset-to-default so a single keystroke of undo always restores the
// pre-reset value). `reset()` wipes history entirely — used on first load
// and whenever the server returns fresh config after save/sync.

const HISTORY_LIMIT = 50
const COALESCE_MS = 500

function useHistoryState<T>(initial: T | null) {
  const [history, setHistory] = useState<{ past: T[]; present: T | null; future: T[] }>({
    past: [],
    present: initial,
    future: [],
  })
  const lastPushAt = useRef(0)

  const set = useCallback((value: T, opts?: { force?: boolean }) => {
    const now = Date.now()
    setHistory((h) => {
      if (h.present === null) return { past: [], present: value, future: [] }
      if (Object.is(h.present, value)) return h
      const shouldPush = opts?.force || now - lastPushAt.current > COALESCE_MS
      lastPushAt.current = now
      return {
        past: shouldPush ? [...h.past, h.present].slice(-HISTORY_LIMIT) : h.past,
        present: value,
        future: [],
      }
    })
  }, [])

  const reset = useCallback((value: T | null) => {
    lastPushAt.current = Date.now()
    setHistory({ past: [], present: value, future: [] })
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length || h.present === null) return h
      const prev = h.past[h.past.length - 1]
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length || h.present === null) return h
      const next = h.future[0]
      return { past: [...h.past, h.present], present: next, future: h.future.slice(1) }
    })
  }, [])

  return {
    state: history.present,
    set,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}

export default function VoicePage() {
  const getToken = useApiToken()
  const { data: config, loading, error, refetch } = useApiData<VoiceConfig>(
    (token) => api.voice.get(token),
    [],
  )
  const {
    state: form,
    set: setForm,
    reset: resetForm,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState<FormState>(null)
  const [syncing, setSyncing] = useState(false)
  const [phones, setPhones] = useState<VoicePhoneNumber[] | null>(null)
  const [phonesLoading, setPhonesLoading] = useState(false)
  const [pendingPhoneId, setPendingPhoneId] = useState<string | null>(null)

  // Tools panel — populated once the API key is configured. Refetched after
  // every successful Save & sync so newly-bound tool ids are reflected
  // without forcing the user to reload.
  const [tools, setTools] = useState<VoiceTool[] | null>(null)
  const [toolsLoading, setToolsLoading] = useState(false)
  const [toolsBoundCount, setToolsBoundCount] = useState(0)

  const loadTools = useCallback(async () => {
    setToolsLoading(true)
    try {
      const token = await getToken()
      const res: VoiceToolsResponse = await api.voice.listTools(token)
      setTools(res.items)
      setToolsBoundCount(res.bound_count)
    } catch (e) {
      // The page is still useful without tools — surface the error but don't
      // crash the layout.
      notifyError(e instanceof ApiError ? e.message : 'Failed to load tools')
    } finally {
      setToolsLoading(false)
    }
  }, [getToken])

  // Auto-load tools once the platform is configured. Re-runs whenever the
  // assistant id changes (e.g. just-created or just-deleted) so the bound
  // badges stay accurate without relying on the user pressing Refresh.
  useEffect(() => {
    const ready = config?.platform_configured ?? config?.has_api_key
    if (ready) {
      void loadTools()
    } else {
      setTools(null)
      setToolsBoundCount(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.platform_configured, config?.has_api_key, config?.assistant_id])

  useEffect(() => {
    if (config && !form) {
      resetForm(settingsToForm(config.settings, config.defaults))
    }
  }, [config, form, resetForm])

  // Reload form whenever sync changes the underlying config. This is an
  // external source of truth, so we wipe the undo history — the user
  // starts fresh after a successful save/sync.
  useEffect(() => {
    if (config) resetForm(settingsToForm(config.settings, config.defaults))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config?.assistant_id,
    config?.platform_configured,
    config?.last_synced_at,
    config?.settings.voice,
  ])

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z / Ctrl+Y = redo.
  // Scoped to this page via the effect lifetime. We only preventDefault when
  // our history can actually act, so native textarea undo still works when
  // the snapshot stack is empty.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y'
      const isUndo = key === 'z' && !e.shiftKey
      if (isRedo && canRedo) {
        e.preventDefault()
        redo()
      } else if (isUndo && canUndo) {
        e.preventDefault()
        undo()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canUndo, canRedo, undo, redo])

  const resetPromptToDefault = () => {
    if (!config || !form) return
    setForm({ ...form, system_prompt: config.defaults.system_prompt }, { force: true })
    notifySuccess('System prompt reset to default. Click Save & sync to publish.')
  }

  const resetFirstMessageToDefault = () => {
    if (!config || !form) return
    setForm({ ...form, first_message: config.defaults.first_message }, { force: true })
  }

  // `platform_configured` is the modern flag; older backend builds only
  // expose `has_api_key` (legacy alias). Treat either as "voice is on".
  const platformReady = Boolean(
    (config as VoiceConfig | null)?.platform_configured ?? config?.has_api_key,
  )

  const status: { color: 'lime' | 'amber' | 'zinc' | 'red'; label: string } = useMemo(() => {
    if (!config) return { color: 'zinc', label: 'Loading' }
    if (!platformReady) return { color: 'red', label: 'Voice disabled' }
    if (!config.assistant_id) return { color: 'amber', label: 'Sync needed' }
    if (!config.phone_number_id) return { color: 'amber', label: 'Bind a phone' }
    return { color: 'lime', label: 'Live' }
  }, [config, platformReady])

  const saveAndSync = async () => {
    if (!form) return
    setSyncing(true)
    try {
      const token = await getToken()
      await api.voice.update(token, formToPatch(form))
      const res = await api.voice.sync(token)

      // Build a human-friendly toast that summarises both the assistant
      // sync and the tool registry changes — the user immediately sees
      // whether anything was created/updated on this run.
      const created = res.tools_created.length
      const updated = res.tools_updated.length
      const failed = res.tools_failed.length
      const parts: string[] = [res.message]
      if (created) parts.push(`${created} tool${created === 1 ? '' : 's'} created`)
      if (updated) parts.push(`${updated} updated`)
      if (failed) parts.push(`${failed} failed`)
      notifySuccess(parts.join(' · '))

      if (failed) {
        notifyError(`Tool sync errors: ${res.tools_failed.join(', ')}`)
      }

      refetch()
      void loadTools()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Save & sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const deleteAssistant = async () => {
    if (!confirm('Delete the assistant on Vapi? You can re-create it with Sync.')) return
    try {
      const token = await getToken()
      await api.voice.deleteAssistant(token)
      notifySuccess('Assistant deleted.')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Delete failed')
    }
  }

  const loadPhones = async () => {
    setPhonesLoading(true)
    try {
      const token = await getToken()
      const list = await api.voice.listPhoneNumbers(token)
      setPhones(list)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Failed to load phone numbers')
    } finally {
      setPhonesLoading(false)
    }
  }

  const attachPhone = async (id: string) => {
    setPendingPhoneId(id)
    try {
      const token = await getToken()
      await api.voice.attachPhoneNumber(token, id)
      notifySuccess('Phone number bound to assistant.')
      refetch()
      loadPhones()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Attach failed')
    } finally {
      setPendingPhoneId(null)
    }
  }

  const detachPhone = async (id: string) => {
    setPendingPhoneId(id)
    try {
      const token = await getToken()
      await api.voice.detachPhoneNumber(token, id)
      notifySuccess('Phone number detached.')
      refetch()
      loadPhones()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Detach failed')
    } finally {
      setPendingPhoneId(null)
    }
  }

  if (loading) {
    return (
      <>
        <Heading>Voice setup</Heading>
        <Divider className="mt-6" />
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Heading>Voice setup</Heading>
        <Divider className="mt-6" />
        <Text className="mt-6 text-red-600">{error}</Text>
      </>
    )
  }

  if (!config) return null

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Voice setup</Heading>
          <Text className="mt-1">
            Customize your AI voice assistant and bind a phone number — voice infrastructure is
            managed by us, no API key required.
          </Text>
        </div>
        <Badge color={status.color}>{status.label}</Badge>
      </div>

      <Divider className="mt-6" />

      {/* Platform-not-configured banner: shown only when the deployment hasn't
          set VAPI_PLATFORM_API_KEY. Customers can't fix this themselves —
          it's purely a heads-up so the empty UI below makes sense. */}
      {!platformReady && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-900/20">
          <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Voice features are not yet enabled on this deployment.</p>
            <p className="mt-1">
              The platform admin needs to configure the Vapi master account before assistants can
              be created. Once that&apos;s set up, this page lights up automatically — no action
              required from your side.
            </p>
          </div>
        </div>
      )}

      {/* Connection summary */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-l-4 border-l-sky-500">
          <CardBody>
            <div className="flex items-start gap-3">
              <KeyIcon className="size-5 text-sky-600" />
              <div className="min-w-0 flex-1">
                <Subheading>Voice platform</Subheading>
                <Text className="mt-1 text-sm">
                  {platformReady
                    ? 'Managed by us — no key needed.'
                    : 'Not yet enabled on this deployment.'}
                </Text>
              </div>
              {platformReady ? (
                <CheckCircleIcon className="size-5 text-lime-600" />
              ) : (
                <ExclamationTriangleIcon className="size-5 text-amber-500" />
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardBody>
            <div className="flex items-start gap-3">
              <CloudArrowUpIcon className="size-5 text-violet-600" />
              <div className="min-w-0 flex-1">
                <Subheading>Assistant</Subheading>
                <Text className="mt-1 break-all text-sm">
                  {config.assistant_id || 'Not provisioned. Click Sync below.'}
                </Text>
                {config.last_synced_at && (
                  <Text className="mt-1 text-xs text-zinc-500">
                    Last synced {formatDateTime(config.last_synced_at)}
                  </Text>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-l-4 border-l-lime-500">
          <CardBody>
            <div className="flex items-start gap-3">
              <PhoneIcon className="size-5 text-lime-600" />
              <div className="min-w-0 flex-1">
                <Subheading>Phone number</Subheading>
                <Text className="mt-1 break-all text-sm">
                  {config.phone_number_id || 'No phone bound yet.'}
                </Text>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Webhook URL */}
      <Card className="mt-6">
        <CardBody>
          <Subheading>Webhook</Subheading>
          <Text className="mt-1 text-sm">
            Vapi will POST tool calls and call events to this URL. Sync registers it and a per-tenant
            secret automatically.
          </Text>
          <code className="mt-3 block break-all rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800">
            {config.webhook_url}
          </code>
          <Text className="mt-2 text-xs text-zinc-500">
            Per-tenant secret: {config.has_webhook_secret ? 'configured' : 'will be generated on next sync'}
          </Text>
        </CardBody>
      </Card>

      {/* Settings form (only when the platform is configured) */}
      {platformReady && form && (
        <Card className="mt-6">
          <CardBody>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Subheading>Assistant configuration</Subheading>
                <Text className="mt-1 text-sm">
                  Edit and click the button to save changes and publish them to Vapi in one step.
                </Text>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  outline
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <ArrowUturnLeftIcon data-slot="icon" />
                  Undo
                </Button>
                <Button
                  outline
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  <ArrowUturnRightIcon data-slot="icon" />
                  Redo
                </Button>
                <Button onClick={saveAndSync} disabled={syncing}>
                  <CloudArrowUpIcon data-slot="icon" className={syncing ? 'animate-spin' : ''} />
                  {config.assistant_id ? 'Save & sync to Vapi' : 'Save & create assistant'}
                </Button>
              </div>
            </div>

            <FieldGroup className="mt-6">
              <Field>
                <div className="flex items-center justify-between">
                  <Label>First message</Label>
                  {form.first_message !== config.defaults.first_message && (
                    <button
                      type="button"
                      onClick={resetFirstMessageToDefault}
                      className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                    >
                      <SparklesIcon className="size-3.5" />
                      Reset to default
                    </button>
                  )}
                </div>
                <Input
                  value={form.first_message}
                  onChange={(e) => setForm({ ...form, first_message: e.target.value })}
                />
                <Description>
                  Spoken when the call connects. Placeholders like <code>{'{{COMPANY_NAME}}'}</code> are
                  filled in automatically from your tenant profile at sync time.
                </Description>
              </Field>

              <Field>
                <div className="flex items-center justify-between">
                  <Label>System prompt</Label>
                  {form.system_prompt !== config.defaults.system_prompt && (
                    <button
                      type="button"
                      onClick={resetPromptToDefault}
                      className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                    >
                      <SparklesIcon className="size-3.5" />
                      Reset to default
                    </button>
                  )}
                </div>
                <Textarea
                  rows={14}
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                />
                <Description>
                  The assistant&apos;s persona and instructions. Tools (booking lookup, knowledge search,
                  create/cancel booking) are wired automatically — just describe how you want it to behave.
                  Tip: <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">Ctrl+Z</kbd>{' '}
                  undoes any change, including Reset to default.
                </Description>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Model provider</Label>
                  <Input
                    value={form.model_provider}
                    onChange={(e) => setForm({ ...form, model_provider: e.target.value })}
                  />
                </Field>
                <Field>
                  <Label>Model</Label>
                  <Input
                    value={form.model_name}
                    onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Voice provider</Label>
                  <Input
                    value={form.voice_provider}
                    onChange={(e) => setForm({ ...form, voice_provider: e.target.value })}
                  />
                  <Description>e.g. 11labs, playht, openai</Description>
                </Field>
                <Field>
                  <Label>Voice id</Label>
                  <Input
                    value={form.voice_id}
                    onChange={(e) => setForm({ ...form, voice_id: e.target.value })}
                  />
                </Field>
              </div>

              <Field>
                <Label>End-call phrases</Label>
                <Input
                  value={form.end_call_phrases}
                  onChange={(e) => setForm({ ...form, end_call_phrases: e.target.value })}
                />
                <Description>Comma-separated. Vapi will hang up when the assistant says any of these.</Description>
              </Field>
            </FieldGroup>

            {config.assistant_id && (
              <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <Button outline onClick={deleteAssistant}>
                  <TrashIcon data-slot="icon" />
                  Delete assistant on Vapi
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Assistant tools — list every catalogue tool, with bound state */}
      {platformReady && (
        <Card className="mt-6">
          <CardBody>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <WrenchScrewdriverIcon className="size-5 text-indigo-500" />
                  <Subheading>Assistant tools</Subheading>
                  {tools && (
                    <Badge color={toolsBoundCount === tools.length ? 'lime' : 'amber'}>
                      {toolsBoundCount}/{tools.length} bound
                    </Badge>
                  )}
                </div>
                <Text className="mt-1 text-sm">
                  These are the capabilities your Vapi assistant can call into. Booking lookups,
                  scheduling, knowledge-base searches — each one POSTs back to your tenant webhook,
                  so live data stays in sync. Tools are created on Vapi during{' '}
                  <em>Save &amp; sync</em>; subsequent syncs only PATCH when their definition changes.
                </Text>
              </div>
              <Button outline onClick={loadTools} disabled={toolsLoading}>
                <ArrowPathIcon
                  data-slot="icon"
                  className={toolsLoading ? 'animate-spin' : ''}
                />
                Refresh
              </Button>
            </div>

            {toolsLoading && tools === null ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : tools && tools.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            ) : (
              <Text className="mt-4 text-sm text-zinc-500">
                No tools available yet. Run <em>Save &amp; sync</em> above to provision them on Vapi.
              </Text>
            )}
          </CardBody>
        </Card>
      )}

      {/* Phone numbers (only when assistant exists) */}
      {platformReady && config.assistant_id && (
        <Card className="mt-6 mb-8">
          <CardBody>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Subheading>Phone numbers</Subheading>
                <Text className="mt-1 text-sm">
                  Bind a Vapi phone number to your assistant so inbound calls reach this tenant.
                </Text>
              </div>
              <Button outline onClick={loadPhones} disabled={phonesLoading}>
                <ArrowPathIcon data-slot="icon" className={phonesLoading ? 'animate-spin' : ''} />
                {phones === null ? 'Load' : 'Refresh'}
              </Button>
            </div>

            {phones === null ? (
              <Text className="mt-4 text-sm text-zinc-500">
                Click <em>Load</em> to fetch the phone numbers in your Vapi account.
              </Text>
            ) : phones.length === 0 ? (
              <Text className="mt-4 text-sm text-zinc-500">
                No phone numbers found in this Vapi account. Provision one in the Vapi dashboard, then
                refresh.
              </Text>
            ) : (
              <Table className="mt-4">
                <TableHead>
                  <TableRow>
                    <TableHeader>Number</TableHeader>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Provider</TableHeader>
                    <TableHeader>Bound assistant</TableHeader>
                    <TableHeader className="text-right">Action</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {phones.map((p) => {
                    const boundToUs = p.assistant_id === config.assistant_id
                    const boundToOther = p.assistant_id && p.assistant_id !== config.assistant_id
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.number || '—'}</TableCell>
                        <TableCell>{p.name || '—'}</TableCell>
                        <TableCell>{p.provider || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {boundToUs ? (
                            <Badge color="lime">This assistant</Badge>
                          ) : boundToOther ? (
                            <span className="text-zinc-500">{p.assistant_id}</span>
                          ) : (
                            <span className="text-zinc-400">unbound</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {boundToUs ? (
                            <Button
                              outline
                              onClick={() => detachPhone(p.id)}
                              disabled={pendingPhoneId === p.id}
                            >
                              Detach
                            </Button>
                          ) : (
                            <Button
                              onClick={() => attachPhone(p.id)}
                              disabled={pendingPhoneId === p.id}
                            >
                              Bind to this assistant
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Tool card — one row in the Assistant tools grid
// ---------------------------------------------------------------------------
//
// Visual rules:
// - Bound tool   → indigo accent + checkmark + the (truncated) Vapi tool id
//                  so customers can cross-reference it in the Vapi dashboard.
// - Unbound tool → amber accent + "Will be created on next sync" hint.
// - Async tools  → tiny lightning icon next to the name (none today, but
//                  future fire-and-forget tools will be flagged for clarity).
//
// We deliberately render the **catalogue** description verbatim — the LLM
// also sees that exact text, so showing it builds trust ("this is the
// instruction the AI follows").

function ToolCard({ tool }: { tool: VoiceTool }) {
  return (
    <div
      className={
        'group flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ' +
        (tool.bound
          ? 'border-zinc-200 dark:border-zinc-800'
          : 'border-amber-200 dark:border-amber-800/60')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <code className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {tool.name}
          </code>
          {tool.is_async && (
            <BoltIcon
              className="size-4 shrink-0 text-amber-500"
              title="Async — assistant continues without waiting for the response"
            />
          )}
        </div>
        {tool.bound ? (
          <Badge color="lime">
            <CheckCircleIcon data-slot="icon" />
            Bound
          </Badge>
        ) : (
          <Badge color="amber">Pending sync</Badge>
        )}
      </div>

      <p className="line-clamp-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {tool.description}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
          <SparklesIcon className="size-3" />
          “{tool.request_start}”
        </span>
        {tool.bound && tool.vapi_tool_id ? (
          <code
            className="truncate rounded bg-zinc-100 px-2 py-0.5 font-mono dark:bg-zinc-800"
            title={tool.vapi_tool_id}
          >
            id: {tool.vapi_tool_id.slice(0, 10)}…
          </code>
        ) : (
          <span className="italic">Will be created on next sync</span>
        )}
      </div>
    </div>
  )
}

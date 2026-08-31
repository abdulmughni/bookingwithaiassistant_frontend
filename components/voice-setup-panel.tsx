'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tab } from '@headlessui/react'
import clsx from 'clsx'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  LanguageIcon,
  LinkIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  PhoneIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  SignalIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  TagIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/20/solid'
import { Heading, Subheading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { Select } from '@/components/select'
import { Switch } from '@/components/switch'
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
import { ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { ReadOnlyBanner } from '@/components/account-status-gate'
import { formatDateTime } from '@/lib/utils'
import type {
  VoiceConfig,
  VoicePhoneNumber,
  VoiceSettings,
  VoiceTool,
  VoiceToolsResponse,
  VoiceSyncResponse,
} from '@/lib/types'


export type VoiceApiAdapter = {
  get: (token: string) => Promise<VoiceConfig>
  update: (token: string, data: Partial<VoiceSettings>) => Promise<VoiceConfig>
  sync: (token: string) => Promise<VoiceSyncResponse>
  deleteAssistant: (token: string) => Promise<VoiceConfig>
  listPhoneNumbers: (token: string) => Promise<VoicePhoneNumber[]>
  createFreeNumber: (token: string, areaCode: string, name?: string) => Promise<VoiceConfig>
  importTwilioNumber: (
    token: string,
    data: {
      number: string
      twilio_account_sid: string
      twilio_auth_token: string
      name?: string
    },
  ) => Promise<VoiceConfig>
  importTelnyxNumber: (
    token: string,
    data: {
      number: string
      telnyx_api_key: string
      name?: string
    },
  ) => Promise<VoiceConfig>
  attachPhoneNumber: (token: string, phoneId: string) => Promise<VoiceConfig>
  detachPhoneNumber: (token: string, phoneId: string) => Promise<VoiceConfig>
  listTools: (token: string) => Promise<VoiceToolsResponse>
}

// ---------------------------------------------------------------------------
// Form state — flat shape that mirrors what the inputs render.
// ---------------------------------------------------------------------------
//
// We split nested Vapi objects (transcriber, startSpeakingPlan, …) into
// flat string/boolean fields here so each <Input>/<Select> binds to a
// single string. `formToPatch` reassembles them into the nested API shape
// at save time.

type FormState = Pick<
  VoiceSettings,
  'system_prompt' | 'first_message' | 'model_provider' | 'model_name'
> & {
  // Channel basics
  first_message_mode: string
  model_temperature: string
  voicemail_detection_enabled: boolean
  voice_provider: string
  voice_id: string
  end_call_phrases: string

  // ElevenLabs (11labs) only — applied when voice_provider === '11labs'
  voice_model: string
  voice_stability: string
  voice_similarity_boost: string
  voice_style: string
  voice_use_speaker_boost: boolean
  voice_optimize_streaming_latency: string
  voice_speed: string // kept for non-11labs / legacy; not shown for 11labs

  // Transcriber (Deepgram)
  transcriber_provider: string
  transcriber_model: string
  transcriber_language: string
  transcriber_smart_format: boolean
  transcriber_numerals: boolean   // "nine seven two" → "972"
  transcriber_keywords: string    // newline / comma separated
  transcriber_keyterm: string     // newline / comma separated
  transcriber_endpointing: string // ms; "" = default

  // Single dashboard toggle that drives Vapi's ``backgroundSpeechDenoisingPlan``
  // for smart (Krisp) denoising, fourier denoising, and fourier media detection
  // — see _build_denoising_plan in the backend.
  denoise_smart_enabled: boolean

  // Speaking timing
  start_smart_provider: string         // livekit | vapi | krisp | deepgram-flux | "" (off)
  start_wait_seconds: string
  stop_num_words: string
  stop_voice_seconds: string
  stop_backoff_seconds: string

  // Call shape
  silence_timeout_seconds: string
  max_duration_seconds: string
  background_sound: string
  recording_enabled: boolean
  voicemail_message: string
  end_call_message: string
}

/** Platform default for Vapi ``startSpeakingPlan.transcriptionEndpointingPlan``. */
const DEFAULT_TRANSCRIPTION_ENDPOINTING = {
  onPunctuationSeconds: 0.3,
  onNoPunctuationSeconds: 1.2,
  onNumberSeconds: 0.5,
} as const

const DEFAULT_FALLBACKS = {
  transcriber_provider: 'deepgram',
  transcriber_model: 'nova-3',
  transcriber_language: 'en',
  voice_provider: '11labs',
  voice_id: 'cjVigY5qzO86Huf0OWal',
  model_temperature: '0.3',
  start_smart_provider: 'livekit',
  start_wait_seconds: '0.6',
  stop_num_words: '2',
  stop_voice_seconds: '0.2',
  stop_backoff_seconds: '1.0',
  silence_timeout_seconds: '20',
  max_duration_seconds: '600',
  background_sound: 'off',
  end_call_phrases: 'take care, goodbye, bye',
  end_call_message: "You're all set — take care!",
} as const

/** Defaults applied the moment a user switches provider to 11labs. */
const ELEVENLABS_DEFAULTS = {
  voiceId: 'cjVigY5qzO86Huf0OWal', // Eric — smooth, trustworthy male
  model: 'eleven_flash_v2_5',
  stability: '0.5',
  similarityBoost: '0.75',
  style: '0',
  useSpeakerBoost: true,
  optimizeStreamingLatency: '3',
} as const

const ELEVENLABS_VOICES: { id: string; label: string }[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel — calm American female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella / Sarah — soft female' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli — young bright female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi — energetic female' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam — deep American male' },
  { id: 'cjVigY5qzO86Huf0OWal', label: 'Eric — smooth, trustworthy male' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni — calm American male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh — deep young male' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold — crisp deep male' },
  { id: 'ThT5KcBeYPX3keUQqHPh', label: 'Dorothy — pleasant British female' },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel — deep British male' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily — warm British female' },
]

const ELEVENLABS_MODELS = [
  { id: 'eleven_flash_v2_5', label: 'eleven_flash_v2_5 (fastest — recommended for calls)' },
  { id: 'eleven_turbo_v2_5', label: 'eleven_turbo_v2_5' },
  { id: 'eleven_multilingual_v2', label: 'eleven_multilingual_v2' },
  { id: 'eleven_monolingual_v1', label: 'eleven_monolingual_v1' },
] as const

const VAPI_VOICES = ['Elliot', 'Emma', 'Cole', 'Hana', 'Kai', 'Mia', 'Zoe'] as const

function listToLines(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((v) => (typeof v === 'string' ? v : String(v ?? '')))
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
}

function linesToList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function settingsToForm(s: VoiceSettings, defaults: VoiceConfig['defaults']): FormState {
  const transcriber = (s.transcriber || {}) as Record<string, unknown>
  const voice = (s.voice || {}) as Record<string, unknown>
  const startPlan = (s.start_speaking_plan || {}) as Record<string, unknown>
  const stopPlan = (s.stop_speaking_plan || {}) as Record<string, unknown>
  const smart = (startPlan.smartEndpointingPlan || {}) as Record<string, unknown>
  const denoisePlan = (s.background_speech_denoising_plan || {}) as Record<string, unknown>
  const smartDenoise =
    (denoisePlan.smartDenoisingPlan as Record<string, unknown> | undefined) || {}
  const stringOrEmpty = (v: unknown) =>
    v === undefined || v === null || v === '' ? '' : String(v)

  return {
    system_prompt: s.system_prompt || defaults.system_prompt,
    first_message: s.first_message || defaults.first_message,
    first_message_mode: s.first_message_mode || 'assistant-speaks-first',
    model_provider: s.model_provider || 'openai',
    model_name: s.model_name || 'gpt-4o-mini',
    model_temperature:
      s.model_temperature !== undefined && s.model_temperature !== null
        ? String(s.model_temperature)
        : DEFAULT_FALLBACKS.model_temperature,
    voicemail_detection_enabled:
      s.voicemail_detection && Object.keys(s.voicemail_detection).length > 0
        ? String(s.voicemail_detection.provider || '').trim() === 'vapi'
        : true,
    voice_provider: String(voice.provider ?? DEFAULT_FALLBACKS.voice_provider),
    voice_id: String(voice.voiceId ?? DEFAULT_FALLBACKS.voice_id),
    end_call_phrases:
      (s.end_call_phrases || []).join(', ') || DEFAULT_FALLBACKS.end_call_phrases,

    voice_model: String(voice.model ?? ELEVENLABS_DEFAULTS.model),
    voice_stability: stringOrEmpty(voice.stability) || ELEVENLABS_DEFAULTS.stability,
    voice_similarity_boost:
      stringOrEmpty(voice.similarityBoost) || ELEVENLABS_DEFAULTS.similarityBoost,
    voice_style: stringOrEmpty(voice.style) || ELEVENLABS_DEFAULTS.style,
    voice_use_speaker_boost:
      typeof voice.useSpeakerBoost === 'boolean'
        ? (voice.useSpeakerBoost as boolean)
        : ELEVENLABS_DEFAULTS.useSpeakerBoost,
    voice_optimize_streaming_latency:
      stringOrEmpty(voice.optimizeStreamingLatency) ||
      ELEVENLABS_DEFAULTS.optimizeStreamingLatency,
    voice_speed: stringOrEmpty(voice.speed),

    transcriber_provider: String(transcriber.provider ?? DEFAULT_FALLBACKS.transcriber_provider),
    transcriber_model: String(transcriber.model ?? DEFAULT_FALLBACKS.transcriber_model),
    transcriber_language: String(transcriber.language ?? DEFAULT_FALLBACKS.transcriber_language),
    transcriber_smart_format:
      typeof transcriber.smartFormat === 'boolean' ? transcriber.smartFormat : true,
    transcriber_numerals:
      typeof transcriber.numerals === 'boolean' ? transcriber.numerals : true,
    transcriber_keywords: listToLines(transcriber.keywords),
    transcriber_keyterm: listToLines(transcriber.keyterm),
    transcriber_endpointing:
      transcriber.endpointing !== undefined && transcriber.endpointing !== null
        ? String(transcriber.endpointing)
        : '',

    start_smart_provider: String(smart.provider ?? DEFAULT_FALLBACKS.start_smart_provider),
    start_wait_seconds:
      startPlan.waitSeconds !== undefined
        ? String(startPlan.waitSeconds)
        : DEFAULT_FALLBACKS.start_wait_seconds,
    stop_num_words:
      stopPlan.numWords !== undefined
        ? String(stopPlan.numWords)
        : DEFAULT_FALLBACKS.stop_num_words,
    stop_voice_seconds:
      stopPlan.voiceSeconds !== undefined
        ? String(stopPlan.voiceSeconds)
        : DEFAULT_FALLBACKS.stop_voice_seconds,
    stop_backoff_seconds:
      stopPlan.backoffSeconds !== undefined
        ? String(stopPlan.backoffSeconds)
        : DEFAULT_FALLBACKS.stop_backoff_seconds,

    silence_timeout_seconds:
      s.silence_timeout_seconds !== undefined && s.silence_timeout_seconds !== null
        ? String(s.silence_timeout_seconds)
        : DEFAULT_FALLBACKS.silence_timeout_seconds,
    max_duration_seconds:
      s.max_duration_seconds !== undefined && s.max_duration_seconds !== null
        ? String(s.max_duration_seconds)
        : DEFAULT_FALLBACKS.max_duration_seconds,
    background_sound: s.background_sound || DEFAULT_FALLBACKS.background_sound,
    recording_enabled: s.recording_enabled !== false,
    voicemail_message: s.voicemail_message || '',
    end_call_message: s.end_call_message || DEFAULT_FALLBACKS.end_call_message,

    denoise_smart_enabled:
      typeof smartDenoise.enabled === 'boolean'
        ? (smartDenoise.enabled as boolean)
        : true,
  }
}

function parseNumberOr(value: string, fallback: number | null): number | null {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : fallback
}

function formToPatch(f: FormState): Partial<VoiceSettings> {
  // Build the transcriber. We always send what the user picked — the
  // backend additionally sanitises (drops `keywords` on nova-3/flux,
  // strips invalid keyword tokens) before pushing to Vapi.
  const transcriber: Record<string, unknown> = {
    provider: f.transcriber_provider || 'deepgram',
    model: f.transcriber_model || 'nova-3',
    language: f.transcriber_language || 'en',
    smartFormat: f.transcriber_smart_format,
    numerals: f.transcriber_numerals,
  }
  const kws = linesToList(f.transcriber_keywords)
  if (kws.length) transcriber.keywords = kws
  const kts = linesToList(f.transcriber_keyterm)
  if (kts.length) transcriber.keyterm = kts
  const ep = parseNumberOr(f.transcriber_endpointing, null)
  if (ep !== null) transcriber.endpointing = ep

  // Speaking plans
  const startPlan: Record<string, unknown> = {}
  if (f.start_smart_provider) {
    const smart: Record<string, unknown> = { provider: f.start_smart_provider }
    if (f.start_smart_provider === 'livekit') {
      smart.waitFunction = '700 + 4000 * x'
    }
    startPlan.smartEndpointingPlan = smart
  }
  const wait = parseNumberOr(f.start_wait_seconds, null)
  if (wait !== null) startPlan.waitSeconds = wait
  startPlan.transcriptionEndpointingPlan = { ...DEFAULT_TRANSCRIPTION_ENDPOINTING }

  const stopPlan: Record<string, unknown> = {}
  const numWords = parseNumberOr(f.stop_num_words, null)
  if (numWords !== null) stopPlan.numWords = numWords
  const voiceSec = parseNumberOr(f.stop_voice_seconds, null)
  if (voiceSec !== null) stopPlan.voiceSeconds = voiceSec
  const backoff = parseNumberOr(f.stop_backoff_seconds, null)
  if (backoff !== null) stopPlan.backoffSeconds = backoff

  // Krisp smart denoising — always persist enabled true/false so Vapi PATCH
  // receives ``smartDenoisingPlan.enabled: false`` when the user turns it off.
  // (Omitting the whole plan left the previous assistant value unchanged.)
  const background_speech_denoising_plan = {
    smartDenoisingPlan: { enabled: f.denoise_smart_enabled },
  }

  // Build voice object. For 11labs we always send the phone-tuned defaults
  // (model / latency / speaker boost) so Sync never drops them.
  const voice: Record<string, unknown> = {
    provider: f.voice_provider,
    voiceId: f.voice_id,
  }
  if (f.voice_provider === '11labs') {
    voice.model = f.voice_model || ELEVENLABS_DEFAULTS.model
    voice.stability = parseNumberOr(f.voice_stability, 0.5)
    voice.similarityBoost = parseNumberOr(f.voice_similarity_boost, 0.75)
    voice.style = parseNumberOr(f.voice_style, 0) ?? 0
    voice.useSpeakerBoost = f.voice_use_speaker_boost
    voice.optimizeStreamingLatency =
      parseNumberOr(f.voice_optimize_streaming_latency, 3) ?? 3
  } else {
    const speed = parseNumberOr(f.voice_speed, null)
    if (speed !== null) voice.speed = speed
  }

  return {
    system_prompt: f.system_prompt,
    first_message: f.first_message,
    first_message_mode: f.first_message_mode,
    model_provider: f.model_provider,
    model_name: f.model_name,
    model_temperature: parseNumberOr(f.model_temperature, null) ?? undefined,
    voice,
    transcriber,
    end_call_phrases: f.end_call_phrases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    start_speaking_plan: startPlan,
    stop_speaking_plan: stopPlan,
    silence_timeout_seconds: parseNumberOr(f.silence_timeout_seconds, null) ?? undefined,
    max_duration_seconds: parseNumberOr(f.max_duration_seconds, null) ?? undefined,
    background_sound: f.background_sound,
    recording_enabled: f.recording_enabled,
    voicemail_detection: f.voicemail_detection_enabled ? { provider: 'vapi' } : {},
    voicemail_message: f.voicemail_message,
    end_call_message: f.end_call_message,
    background_speech_denoising_plan,
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

export function VoiceSetupPanel({
  api: voiceApi,
  readOnly = false,
  showAccountBanner = false,
}: {
  api: VoiceApiAdapter
  readOnly?: boolean
  showAccountBanner?: boolean
}) {
  const getToken = useApiToken()
  const { data: config, loading, error, refetch } = useApiData<VoiceConfig>(
    (token) => voiceApi.get(token),
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
  const [freeAreaCode, setFreeAreaCode] = useState('')
  const [creatingFree, setCreatingFree] = useState(false)
  const [selectedFreeId, setSelectedFreeId] = useState('')
  const [twilioNumber, setTwilioNumber] = useState('')
  const [twilioAccountSid, setTwilioAccountSid] = useState('')
  const [twilioAuthToken, setTwilioAuthToken] = useState('')
  const [twilioName, setTwilioName] = useState('')
  const [importingTwilio, setImportingTwilio] = useState(false)
  const [paidProvider, setPaidProvider] = useState<'twilio' | 'telnyx'>('twilio')
  const [telnyxNumber, setTelnyxNumber] = useState('')
  const [telnyxApiKey, setTelnyxApiKey] = useState('')
  const [telnyxName, setTelnyxName] = useState('')
  const [importingTelnyx, setImportingTelnyx] = useState(false)

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
      const res: VoiceToolsResponse = await voiceApi.listTools(token)
      setTools(res.items)
      setToolsBoundCount(res.bound_count)
    } catch (e) {
      // The page is still useful without tools — surface the error but don't
      // crash the layout.
      notifyError(e instanceof ApiError ? e.message : 'Failed to load tools')
    } finally {
      setToolsLoading(false)
    }
  }, [getToken, voiceApi])

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
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    setSyncing(true)
    try {
      const token = await getToken()
      await voiceApi.update(token, formToPatch(form))
      const res = await voiceApi.sync(token)

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
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    if (!confirm('Delete the assistant on Vapi? You can re-create it with Sync.')) return
    try {
      const token = await getToken()
      await voiceApi.deleteAssistant(token)
      notifySuccess('Assistant deleted.')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Delete failed')
    }
  }

  const loadPhones = useCallback(async () => {
    setPhonesLoading(true)
    try {
      const token = await getToken()
      const list = await voiceApi.listPhoneNumbers(token)
      setPhones(list)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Failed to load phone numbers')
    } finally {
      setPhonesLoading(false)
    }
  }, [getToken])

  // Auto-load the numbers once the assistant exists so the "pick an existing
  // free number" dropdown is populated without a manual click.
  useEffect(() => {
    if (platformReady && config?.assistant_id && phones === null) {
      void loadPhones()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformReady, config?.assistant_id])

  const createFreeNumber = async () => {
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    const areaCode = freeAreaCode.replace(/\D/g, '')
    if (areaCode.length !== 3) {
      notifyError('Enter a valid 3-digit US area code (e.g. 415).')
      return
    }
    setCreatingFree(true)
    try {
      const token = await getToken()
      await voiceApi.createFreeNumber(token, areaCode)
      notifySuccess('Free test number created and connected.')
      setFreeAreaCode('')
      refetch()
      loadPhones()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not create a free number')
    } finally {
      setCreatingFree(false)
    }
  }

  const importTwilioNumber = async () => {
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    const number = twilioNumber.trim()
    const accountSid = twilioAccountSid.trim()
    const authToken = twilioAuthToken.trim()
    if (!number || !accountSid || !authToken) {
      notifyError('Phone number, Twilio Account SID, and Auth Token are required.')
      return
    }
    setImportingTwilio(true)
    try {
      const token = await getToken()
      await voiceApi.importTwilioNumber(token, {
        number,
        twilio_account_sid: accountSid,
        twilio_auth_token: authToken,
        name: twilioName.trim() || undefined,
      })
      notifySuccess('Twilio number imported and connected.')
      setTwilioNumber('')
      setTwilioAccountSid('')
      setTwilioAuthToken('')
      setTwilioName('')
      refetch()
      loadPhones()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not import Twilio number')
    } finally {
      setImportingTwilio(false)
    }
  }

  const importTelnyxNumber = async () => {
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    const number = telnyxNumber.trim()
    const apiKey = telnyxApiKey.trim()
    if (!number || !apiKey) {
      notifyError('Phone number and Telnyx API key are required.')
      return
    }
    setImportingTelnyx(true)
    try {
      const token = await getToken()
      await voiceApi.importTelnyxNumber(token, {
        number,
        telnyx_api_key: apiKey,
        name: telnyxName.trim() || undefined,
      })
      notifySuccess('Telnyx number imported and connected.')
      setTelnyxNumber('')
      setTelnyxApiKey('')
      setTelnyxName('')
      refetch()
      loadPhones()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not import Telnyx number')
    } finally {
      setImportingTelnyx(false)
    }
  }

  const attachPhone = async (id: string) => {
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    setPendingPhoneId(id)
    try {
      const token = await getToken()
      await voiceApi.attachPhoneNumber(token, id)
      notifySuccess('Phone number connected.')
      setSelectedFreeId('')
      refetch()
      loadPhones()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Attach failed')
    } finally {
      setPendingPhoneId(null)
    }
  }

  const detachPhone = async (id: string) => {
    if (readOnly) {
      notifyError('Settings are locked until your account is activated.')
      return
    }
    setPendingPhoneId(id)
    try {
      const token = await getToken()
      await voiceApi.detachPhoneNumber(token, id)
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
        <Card className="relative overflow-hidden border-zinc-200/80 bg-linear-to-br from-sky-50 via-white to-violet-50/60 dark:border-white/10 dark:from-sky-950/30 dark:via-zinc-900 dark:to-violet-950/30">
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="size-12 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-72 animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-700/60" />
              </div>
            </div>
          </CardBody>
        </Card>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/60"
            />
          ))}
        </div>
      </>
    )
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="size-5 shrink-0 text-rose-500" />
            <div>
              <Subheading>Voice setup unavailable</Subheading>
              <Text className="mt-1 text-sm text-rose-700 dark:text-rose-400">{error}</Text>
            </div>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (!config) return null

  // Free Vapi numbers already in the account that nobody has claimed yet
  // (no assistant and no server URL bound).
  const availableFreeNumbers = (phones ?? []).filter(
    (p) =>
      (p.provider || '').toLowerCase() === 'vapi' &&
      !p.assistant_id &&
      !p.server_url &&
      p.id !== config.phone_number_id,
  )

  return (
    <div className="space-y-6">
      {showAccountBanner ? <ReadOnlyBanner /> : null}
      {/* ───────── HERO ─────────────────────────────────────────────────
          One glanceable header that carries: branding, status, primary
          action, and the four most-asked-for facts (assistant id, last
          sync, phone, webhook secret state). Replaces the older
          three-card status strip, so the eye lands on a single coherent
          surface instead of a row of disconnected boxes. */}
      <Card className="relative overflow-hidden border-zinc-200/80 bg-linear-to-br from-brand-50 via-white to-brand-50/60 dark:border-zinc-700/80 dark:from-brand-950/30 dark:via-zinc-900 dark:to-brand-950/20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10"
        />
        <CardBody className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-600 to-brand-600 text-white shadow-lg shadow-brand-500/25 ring-1 ring-white/40">
                <MicrophoneIcon className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Heading>Voice assistant</Heading>
                  <StatusPill color={status.color} label={status.label} />
                </div>
                <Text className="mt-1 max-w-2xl">
                  Customize your AI voice assistant and bind a phone number. Voice
                  infrastructure is fully managed — no API keys required.
                </Text>
              </div>
            </div>

            {platformReady && form && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-zinc-950/10 bg-white/70 p-0.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                    className="inline-flex size-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-white/10"
                  >
                    <ArrowUturnLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                    aria-label="Redo"
                    className="inline-flex size-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-white/10"
                  >
                    <ArrowUturnRightIcon className="size-4" />
                  </button>
                </div>
                <Button onClick={saveAndSync} disabled={syncing || readOnly}>
                  <CloudArrowUpIcon
                    data-slot="icon"
                    className={syncing ? 'animate-spin' : ''}
                  />
                  {syncing
                    ? 'Syncing…'
                    : config.assistant_id
                    ? 'Save & sync'
                    : 'Save & create assistant'}
                </Button>
              </div>
            )}
          </div>

          {/* Stats strip — three horizontal facts. Mobile collapses to a
              column; from sm+ they sit on one line as cards. */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <HeroStat
              icon={<ServerStackIcon className="size-5 text-sky-600 dark:text-sky-400" />}
              accent="sky"
              label="Assistant"
              value={
                config.assistant_id ? (
                  <code className="text-xs font-medium">{config.assistant_id}</code>
                ) : (
                  <span className="text-zinc-500">Not provisioned yet</span>
                )
              }
              hint={
                config.last_synced_at
                  ? `Last synced ${formatDateTime(config.last_synced_at)}`
                  : platformReady
                  ? 'Click Save & sync to provision'
                  : undefined
              }
            />
            <HeroStat
              icon={<PhoneIcon className="size-5 text-brand-600 dark:text-brand-400" />}
              accent="brand"
              label="Phone number"
              value={
                config.phone_number_id ? (
                  <code className="text-xs font-medium">{config.phone_number_id}</code>
                ) : (
                  <span className="text-zinc-500">Not bound</span>
                )
              }
              hint={
                config.phone_number_id
                  ? 'Inbound calls reach this assistant'
                  : 'Bind a number from the table below'
              }
            />
            <HeroStat
              icon={<ShieldCheckIcon className="size-5 text-violet-600 dark:text-violet-400" />}
              accent="violet"
              label="Webhook secret"
              value={
                config.has_webhook_secret ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-400">
                    <CheckCircleIcon className="size-4" />
                    Configured
                  </span>
                ) : (
                  <span className="text-zinc-500 text-xs">Generated on next sync</span>
                )
              }
              hint="Authenticates Vapi → backend webhooks"
            />
          </div>
        </CardBody>
      </Card>

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

      {/* ───────── WEBHOOK ──────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-400">
                <LinkIcon className="size-5" />
              </div>
              <div>
                <Subheading>Webhook endpoint</Subheading>
                <Text className="mt-1 text-sm">
                  Vapi posts tool calls and call events to this URL. Sync registers it and a
                  per-tenant secret automatically.
                </Text>
              </div>
            </div>
            <CopyButton text={config.webhook_url} />
          </div>
          <code className="mt-4 block break-all rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
            {config.webhook_url}
          </code>
        </CardBody>
      </Card>

      {/* Settings form (only when the platform is configured) */}
      {platformReady && form && (
        <Card className="mt-6">
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-400">
                <SparklesIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <Subheading>Assistant configuration</Subheading>
                <Text className="mt-1 text-sm">
                  Edit any tab below — your changes publish to Vapi when you click{' '}
                  <strong>Save &amp; sync</strong>.
                </Text>
              </div>
            </div>

            {/* --------------------------------------------------------
                Tabbed configuration — mirrors Vapi's Model / Voice /
                Transcriber / Tools / Advanced layout so customers who
                cross-reference the Vapi dashboard find the same fields
                under the same tabs.
                -------------------------------------------------------- */}
            <Tab.Group>
              <Tab.List className="mt-6 inline-flex w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/60">
                {[
                  { label: 'Model', icon: CpuChipIcon },
                  { label: 'Voice', icon: SpeakerWaveIcon },
                  { label: 'Transcriber', icon: MicrophoneIcon },
                  { label: 'Tools', icon: WrenchScrewdriverIcon },
                  { label: 'Advanced', icon: AdjustmentsHorizontalIcon },
                ].map(({ label, icon: Icon }) => (
                  <Tab
                    key={label}
                    className={({ selected }) =>
                      clsx(
                        'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all',
                        selected
                          ? 'bg-white text-sky-700 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:text-sky-300 dark:ring-white/10'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                      )
                    }
                  >
                    <Icon className="size-4" />
                    {label}
                  </Tab>
                ))}
              </Tab.List>

              <Tab.Panels className="mt-6">
                {/* Read-only accounts can browse every tab, but all form
                    controls inside are natively disabled via this fieldset
                    (backend write endpoints also 403). */}
                <fieldset
                  disabled={readOnly}
                  className={clsx('min-w-0', readOnly && 'opacity-60 select-none')}
                >
                {/* ============== MODEL =============================== */}
                <Tab.Panel className="space-y-5">
                  <PanelSection
                    icon={<ChatBubbleLeftRightIcon className="size-5" />}
                    accent="sky"
                    title="Greeting"
                    subtitle="What the assistant says first, and how the call opens."
                  >
                    <FieldGroup>
                      <Field>
                        <div className="flex items-center justify-between">
                          <Label>First message</Label>
                          {form.first_message !== config.defaults.first_message && (
                            <ResetButton onClick={resetFirstMessageToDefault} />
                          )}
                        </div>
                        <Input
                          value={form.first_message}
                          onChange={(e) =>
                            setForm({ ...form, first_message: e.target.value })
                          }
                        />
                        <Description>
                          Spoken when the call connects. Placeholders like{' '}
                          <code>{'{{COMPANY_NAME}}'}</code> are filled in automatically from
                          your tenant profile at sync time.
                        </Description>
                      </Field>

                      <Field>
                        <Label>First message mode</Label>
                        <Select
                          value={form.first_message_mode}
                          onChange={(e) =>
                            setForm({ ...form, first_message_mode: e.target.value })
                          }
                        >
                          <option value="assistant-speaks-first">Assistant speaks first</option>
                          <option value="assistant-speaks-first-with-model-generated-message">
                            Assistant speaks first (LLM-generated)
                          </option>
                          <option value="assistant-waits-for-user">Wait for the user</option>
                        </Select>
                        <Description>
                          LLM-generated lets the model open dynamically using the system prompt
                          instead of the canned first message.
                        </Description>
                      </Field>
                    </FieldGroup>
                  </PanelSection>

                  <PanelSection
                    icon={<SparklesIcon className="size-5" />}
                    accent="violet"
                    title="Persona & instructions"
                    subtitle="How the assistant should behave on calls. Tools are wired automatically."
                    headerExtra={
                      form.system_prompt !== config.defaults.system_prompt ? (
                        <ResetButton onClick={resetPromptToDefault} />
                      ) : null
                    }
                  >
                    <Field>
                      <Label className="sr-only">System prompt</Label>
                      <Textarea
                        rows={14}
                        value={form.system_prompt}
                        onChange={(e) =>
                          setForm({ ...form, system_prompt: e.target.value })
                        }
                      />
                      <Description>
                        Tip:{' '}
                        <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                          Ctrl+Z
                        </kbd>{' '}
                        undoes any change, including <em>Reset to default</em>.
                      </Description>
                    </Field>
                  </PanelSection>

                  <PanelSection
                    icon={<CpuChipIcon className="size-5" />}
                    accent="brand"
                    title="Reasoning model"
                    subtitle="Which LLM powers the conversation, and when to hang up."
                  >
                    <FieldGroup>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <Label>Model provider</Label>
                          <Select
                            value={form.model_provider}
                            onChange={(e) =>
                              setForm({ ...form, model_provider: e.target.value })
                            }
                          >
                            <option value="openai">openai</option>
                            <option value="anthropic">anthropic</option>
                            <option value="google">google</option>
                            <option value="groq">groq</option>
                            <option value="custom-llm">custom-llm</option>
                          </Select>
                        </Field>
                        <Field>
                          <Label>Model</Label>
                          <Input
                            value={form.model_name}
                            onChange={(e) =>
                              setForm({ ...form, model_name: e.target.value })
                            }
                          />
                          <Description>
                            e.g. <code>gpt-4o-mini</code>, <code>gpt-4o</code>,{' '}
                            <code>claude-3-5-sonnet</code>.
                          </Description>
                        </Field>
                      </div>

                      <Field>
                        <Label>Model temperature</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={form.model_temperature}
                          onChange={(e) =>
                            setForm({ ...form, model_temperature: e.target.value })
                          }
                        />
                        <Description>
                          Lower = more consistent (0.3 recommended for booking flows).
                        </Description>
                      </Field>

                      <Field>
                        <Label>End-call phrases</Label>
                        <Input
                          value={form.end_call_phrases}
                          onChange={(e) =>
                            setForm({ ...form, end_call_phrases: e.target.value })
                          }
                        />
                        <Description>
                          Comma-separated ending-only phrases. Avoid common conversational words
                          such as &quot;okay&quot; or &quot;great&quot; to prevent accidental
                          hangups.
                        </Description>
                      </Field>
                    </FieldGroup>
                  </PanelSection>
                </Tab.Panel>

                {/* ============== VOICE =============================== */}
                <Tab.Panel className="space-y-5">
                  <PanelSection
                    icon={<SpeakerWaveIcon className="size-5" />}
                    accent="rose"
                    title="Voice"
                    subtitle="The TTS provider and voice that speaks to your callers."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <Label>Voice provider</Label>
                        <Select
                          value={form.voice_provider}
                          onChange={(e) => {
                            const next = e.target.value
                            if (next === '11labs') {
                              setForm({
                                ...form,
                                voice_provider: next,
                                voice_id: ELEVENLABS_DEFAULTS.voiceId,
                                voice_model: ELEVENLABS_DEFAULTS.model,
                                voice_stability: ELEVENLABS_DEFAULTS.stability,
                                voice_similarity_boost: ELEVENLABS_DEFAULTS.similarityBoost,
                                voice_style: ELEVENLABS_DEFAULTS.style,
                                voice_use_speaker_boost: ELEVENLABS_DEFAULTS.useSpeakerBoost,
                                voice_optimize_streaming_latency:
                                  ELEVENLABS_DEFAULTS.optimizeStreamingLatency,
                              })
                            } else if (next === 'vapi') {
                              setForm({
                                ...form,
                                voice_provider: next,
                                voice_id: DEFAULT_FALLBACKS.voice_id,
                              })
                            } else {
                              setForm({ ...form, voice_provider: next })
                            }
                          }}
                        >
                          <option value="vapi">vapi (built-in)</option>
                          <option value="11labs">11labs (ElevenLabs)</option>
                          <option value="playht">playht</option>
                          <option value="openai">openai</option>
                          <option value="cartesia">cartesia</option>
                          <option value="azure">azure</option>
                          <option value="deepgram">deepgram</option>
                        </Select>
                        <Description>
                          The TTS provider that turns the assistant&apos;s text into audio.
                        </Description>
                      </Field>

                      {form.voice_provider === 'vapi' ? (
                        <Field>
                          <Label>Voice id</Label>
                          <Select
                            value={form.voice_id}
                            onChange={(e) => setForm({ ...form, voice_id: e.target.value })}
                          >
                            {VAPI_VOICES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                            {!VAPI_VOICES.includes(
                              form.voice_id as (typeof VAPI_VOICES)[number],
                            ) && form.voice_id ? (
                              <option value={form.voice_id}>{form.voice_id} (custom)</option>
                            ) : null}
                          </Select>
                          <Description>Built-in Vapi voices (case-sensitive).</Description>
                        </Field>
                      ) : form.voice_provider !== '11labs' ? (
                        <Field>
                          <Label>Voice id</Label>
                          <Input
                            value={form.voice_id}
                            onChange={(e) => setForm({ ...form, voice_id: e.target.value })}
                          />
                          <Description>Provider-specific voice identifier.</Description>
                        </Field>
                      ) : null}
                    </div>
                  </PanelSection>

                  {form.voice_provider === '11labs' && (
                    <PanelSection
                      icon={<AdjustmentsHorizontalIcon className="size-5" />}
                      accent="indigo"
                      title="ElevenLabs settings"
                      subtitle="Phone-tuned defaults for low latency. Change only if you need a different voice or feel."
                      headerExtra={
                        <a
                          href="https://docs.vapi.ai/providers/voice/elevenlabs"
                          target="_blank"
                          rel="noopener"
                          className="text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                        >
                          ElevenLabs docs ↗
                        </a>
                      }
                    >
                      <FieldGroup>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <Label>Voice</Label>
                            <Select
                              value={
                                ELEVENLABS_VOICES.some((v) => v.id === form.voice_id)
                                  ? form.voice_id
                                  : '__custom__'
                              }
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '__custom__') return
                                setForm({ ...form, voice_id: v })
                              }}
                            >
                              {ELEVENLABS_VOICES.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label}
                                </option>
                              ))}
                              <option value="__custom__">Custom voice ID…</option>
                            </Select>
                            <Description>
                              Premade ElevenLabs voices. Default: Rachel (best for phone).
                            </Description>
                          </Field>
                          <Field>
                            <Label>Custom voice ID</Label>
                            <Input
                              value={form.voice_id}
                              onChange={(e) => setForm({ ...form, voice_id: e.target.value })}
                              placeholder="Paste your ElevenLabs voiceId"
                            />
                            <Description>
                              From Vapi Voice Library (copy ID) or your own ElevenLabs voice.
                            </Description>
                          </Field>
                        </div>

                        <Field>
                          <Label>Model</Label>
                          <Select
                            value={form.voice_model}
                            onChange={(e) => setForm({ ...form, voice_model: e.target.value })}
                          >
                            {ELEVENLABS_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </Select>
                          <Description>
                            <code>eleven_flash_v2_5</code> is fastest — recommended for live phone
                            calls.
                          </Description>
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <SliderField
                            label="Stability"
                            value={form.voice_stability}
                            onChange={(v) => setForm({ ...form, voice_stability: v })}
                            min={0}
                            max={1}
                            step={0.05}
                            placeholder="0.5"
                            hint="Default 0.5. Lower = more expressive; higher = more consistent."
                          />
                          <SliderField
                            label="Similarity boost"
                            value={form.voice_similarity_boost}
                            onChange={(v) =>
                              setForm({ ...form, voice_similarity_boost: v })
                            }
                            min={0}
                            max={1}
                            step={0.05}
                            placeholder="0.8"
                            hint="Default 0.8. How closely to match the original speaker."
                          />
                          <SliderField
                            label="Style"
                            value={form.voice_style}
                            onChange={(v) => setForm({ ...form, voice_style: v })}
                            min={0}
                            max={1}
                            step={0.05}
                            placeholder="0"
                            hint="Default 0. Amplifies stylistic traits (can add latency)."
                          />
                          <Field>
                            <Label>Streaming latency (0–4)</Label>
                            <Select
                              value={form.voice_optimize_streaming_latency}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  voice_optimize_streaming_latency: e.target.value,
                                })
                              }
                            >
                              <option value="0">0 — highest quality</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3 — recommended for calls</option>
                              <option value="4">4 — lowest latency</option>
                            </Select>
                            <Description>
                              Higher = snappier replies on phone (default 3).
                            </Description>
                          </Field>
                        </div>

                        <SwitchTile
                          label="Speaker boost"
                          description="Post-process clarity for phone speakers. Default on."
                          checked={form.voice_use_speaker_boost}
                          onChange={(v) =>
                            setForm({ ...form, voice_use_speaker_boost: v })
                          }
                        />
                      </FieldGroup>
                    </PanelSection>
                  )}

                  <PanelSection
                    icon={<MusicalNoteIcon className="size-5" />}
                    accent="amber"
                    title="Background sound"
                    subtitle="Optional ambience so the AI feels less sterile on calls."
                  >
                    <Field>
                      <Label className="sr-only">Background sound</Label>
                      <Select
                        value={form.background_sound}
                        onChange={(e) =>
                          setForm({ ...form, background_sound: e.target.value })
                        }
                      >
                        <option value="off">Off (cleanest)</option>
                        <option value="office">Office (small call-center)</option>
                      </Select>
                    </Field>
                  </PanelSection>
                </Tab.Panel>

                {/* ============== TRANSCRIBER ========================= */}
                <Tab.Panel className="space-y-5">
                  <PanelSection
                    icon={<MicrophoneIcon className="size-5" />}
                    accent="sky"
                    title="Provider & model"
                    subtitle="Speech-to-text engine that captures what your callers say."
                    headerExtra={
                      <a
                        href="https://docs.vapi.ai/customization/custom-keywords"
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                      >
                        Custom keywords ↗
                      </a>
                    }
                  >
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field>
                        <Label>Provider</Label>
                        <Select
                          value={form.transcriber_provider}
                          onChange={(e) =>
                            setForm({ ...form, transcriber_provider: e.target.value })
                          }
                        >
                          <option value="deepgram">deepgram</option>
                          <option value="assembly-ai">assembly-ai</option>
                          <option value="azure">azure</option>
                          <option value="openai">openai</option>
                          <option value="gladia">gladia</option>
                          <option value="talkscriber">talkscriber</option>
                        </Select>
                      </Field>
                      <Field>
                        <Label>Model</Label>
                        <Select
                          value={form.transcriber_model}
                          onChange={(e) =>
                            setForm({ ...form, transcriber_model: e.target.value })
                          }
                        >
                          <option value="nova-3">nova-3 (recommended)</option>
                          <option value="nova-3-general">nova-3-general</option>
                          <option value="nova-3-medical">nova-3-medical</option>
                          <option value="nova-2">nova-2</option>
                          <option value="nova-2-general">nova-2-general</option>
                          <option value="flux-general-en">flux-general-en (built-in EOT)</option>
                          <option value="flux-general-multi">flux-general-multi</option>
                        </Select>
                        <Description>
                          nova-3 is the latest, most accurate Deepgram model.{' '}
                          <code>flux-*</code> ships with built-in end-of-turn detection — pair
                          with no <em>smart endpointing</em>.
                        </Description>
                      </Field>
                      <Field>
                        <Label>Language</Label>
                        <Select
                          value={form.transcriber_language}
                          onChange={(e) =>
                            setForm({ ...form, transcriber_language: e.target.value })
                          }
                        >
                          <option value="en">English (en)</option>
                          <option value="es">Spanish (es)</option>
                          <option value="fr">French (fr)</option>
                          <option value="de">German (de)</option>
                          <option value="it">Italian (it)</option>
                          <option value="nl">Dutch (nl)</option>
                          <option value="pt">Portuguese (pt)</option>
                          <option value="ja">Japanese (ja)</option>
                          <option value="hi">Hindi (hi)</option>
                          <option value="ru">Russian (ru)</option>
                        </Select>
                      </Field>
                    </div>
                  </PanelSection>

                  <PanelSection
                    icon={<LanguageIcon className="size-5" />}
                    accent="brand"
                    title="Output formatting"
                    subtitle="How Deepgram cleans up the transcribed text before the LLM sees it."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SwitchTile
                        label="Smart formatting"
                        description={
                          <>
                            Post-processing pass for emails, currencies, dates, and addresses
                            (&ldquo;at gmail dot com&rdquo; → <code>@gmail.com</code>).
                          </>
                        }
                        checked={form.transcriber_smart_format}
                        onChange={(v) =>
                          setForm({ ...form, transcriber_smart_format: v })
                        }
                      />
                      <SwitchTile
                        label="Numerals"
                        description={
                          <>
                            Spoken digit sequences become numerals — &ldquo;nine seven two&rdquo;
                            → <code>972</code>. Critical for phone numbers and times.
                          </>
                        }
                        checked={form.transcriber_numerals}
                        onChange={(v) =>
                          setForm({ ...form, transcriber_numerals: v })
                        }
                      />
                    </div>
                  </PanelSection>

                  <PanelSection
                    icon={<TagIcon className="size-5" />}
                    accent="violet"
                    title="Vocabulary boost"
                    subtitle="Help the model recognize your business words and customer phrases."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <Label>Keyterms (phrases)</Label>
                        <Textarea
                          rows={5}
                          value={form.transcriber_keyterm}
                          onChange={(e) =>
                            setForm({ ...form, transcriber_keyterm: e.target.value })
                          }
                          placeholder="e.g. phone number, full name, email address"
                        />
                        <Description>
                          One phrase per line (or commas). Boosts multi-word phrases such as{' '}
                          <code>phone number</code>, <code>full name</code>,{' '}
                          <code>email address</code>, <code>appointment</code>. Required
                          vocabulary on <strong>nova-3</strong> and <strong>flux-*</strong>;
                          works alongside keywords on nova-2.
                        </Description>
                      </Field>
                      <Field>
                        <Label>Keywords (single words, nova-2 only)</Label>
                        <Textarea
                          rows={5}
                          value={form.transcriber_keywords}
                          onChange={(e) =>
                            setForm({ ...form, transcriber_keywords: e.target.value })
                          }
                          placeholder="e.g. YourCompanyName:30, FirstName:20, Phone:15"
                        />
                        <Description>
                          One token per line — letters/digits only, optional integer boost (
                          <code>:5</code>, <code>:-10</code>). Spaces are not allowed; use
                          Keyterms instead. Auto-dropped on nova-3 / flux-* (Vapi rejects it
                          there).
                        </Description>
                      </Field>
                    </div>
                  </PanelSection>

                  <PanelSection
                    icon={<ShieldCheckIcon className="size-5" />}
                    accent="brand"
                    title="Audio quality"
                    subtitle="Filter background noise and tune end-of-utterance detection."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <Label>Endpointing (ms)</Label>
                        <Input
                          type="number"
                          value={form.transcriber_endpointing}
                          onChange={(e) =>
                            setForm({ ...form, transcriber_endpointing: e.target.value })
                          }
                          placeholder="default"
                        />
                        <Description>
                          Silence (ms) before Deepgram closes the utterance. Lower = snappier;
                          higher = fewer mid-thought interruptions. Blank = model default.
                        </Description>
                      </Field>
                      <SwitchTile
                        label="Background denoising"
                        description={
                          <>
                            Filters keyboard typing, traffic, AC and background voices before
                            speech is transcribed. Enables Krisp smart denoising and Vapi&apos;s
                            Fourier media filter together.
                          </>
                        }
                        checked={form.denoise_smart_enabled}
                        onChange={(v) =>
                          setForm({ ...form, denoise_smart_enabled: v })
                        }
                      />
                    </div>
                  </PanelSection>
                </Tab.Panel>

                {/* ============== TOOLS ============================== */}
                <Tab.Panel>
                  <PanelSection
                    icon={<WrenchScrewdriverIcon className="size-5" />}
                    accent="amber"
                    title="Assistant tools"
                    subtitle={
                      <>
                        Capabilities your assistant can call into. Each one POSTs back to your
                        tenant webhook, so live data stays in sync.
                      </>
                    }
                    headerExtra={
                      <div className="flex items-center gap-2">
                        {tools && (
                          <Badge color={toolsBoundCount === tools.length ? 'lime' : 'amber'}>
                            {toolsBoundCount}/{tools.length} bound
                          </Badge>
                        )}
                        <Button outline onClick={loadTools} disabled={toolsLoading}>
                          <ArrowPathIcon
                            data-slot="icon"
                            className={toolsLoading ? 'animate-spin' : ''}
                          />
                          Refresh
                        </Button>
                      </div>
                    }
                  >
                    {toolsLoading && tools === null ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/50"
                          />
                        ))}
                      </div>
                    ) : tools && tools.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {tools.map((tool) => (
                          <ToolCard key={tool.name} tool={tool} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/40 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
                        No tools available yet. Run <em>Save &amp; sync</em> at the top to
                        provision them on Vapi.
                      </div>
                    )}
                  </PanelSection>
                </Tab.Panel>

                {/* ============== ADVANCED =========================== */}
                <Tab.Panel className="space-y-5">
                  <PanelSection
                    icon={<ClockIcon className="size-5" />}
                    accent="indigo"
                    title="Conversation timing"
                    subtitle="When the assistant starts talking, and how it handles interruptions."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <Label>Smart endpointing</Label>
                        <Select
                          value={form.start_smart_provider}
                          onChange={(e) =>
                            setForm({ ...form, start_smart_provider: e.target.value })
                          }
                        >
                          <option value="livekit">livekit (English, recommended)</option>
                          <option value="vapi">vapi (non-English)</option>
                          <option value="krisp">krisp (audio-based)</option>
                          <option value="">Off — use transcriber EOT only</option>
                        </Select>
                        <Description>
                          Detects when the customer finished speaking. Turn off when using
                          <code> flux-*</code> or AssemblyAI (they have their own EOT).
                        </Description>
                      </Field>
                      <Field>
                        <Label>Wait before speaking (s)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={form.start_wait_seconds}
                          onChange={(e) =>
                            setForm({ ...form, start_wait_seconds: e.target.value })
                          }
                        />
                        <Description>
                          0.4 standard, 0.6–0.8 healthcare/formal, 0.0–0.2 fast.
                        </Description>
                      </Field>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <Field>
                        <Label>Interruption: words</Label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          value={form.stop_num_words}
                          onChange={(e) =>
                            setForm({ ...form, stop_num_words: e.target.value })
                          }
                        />
                        <Description>
                          0 = VAD (fastest). 1–2 reduces noise triggers.
                        </Description>
                      </Field>
                      <Field>
                        <Label>Voice seconds</Label>
                        <Input
                          type="number"
                          step="0.05"
                          min="0"
                          max="0.5"
                          value={form.stop_voice_seconds}
                          onChange={(e) =>
                            setForm({ ...form, stop_voice_seconds: e.target.value })
                          }
                        />
                        <Description>
                          VAD threshold (only used when words = 0). 0.2 balanced.
                        </Description>
                      </Field>
                      <Field>
                        <Label>Backoff (s)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={form.stop_backoff_seconds}
                          onChange={(e) =>
                            setForm({ ...form, stop_backoff_seconds: e.target.value })
                          }
                        />
                        <Description>
                          Quiet period after an interrupt before the AI can speak.
                        </Description>
                      </Field>
                    </div>
                  </PanelSection>

                  <PanelSection
                    icon={<SignalIcon className="size-5" />}
                    accent="rose"
                    title="Call behavior"
                    subtitle="Duration limits and recording."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <Label>Silence timeout (s)</Label>
                        <Input
                          type="number"
                          min="10"
                          max="120"
                          value={form.silence_timeout_seconds}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              silence_timeout_seconds: e.target.value,
                            })
                          }
                        />
                        <Description>
                          Hang up after this many seconds of total silence. Recommended: 20.
                        </Description>
                      </Field>
                      <Field>
                        <Label>Max duration (s)</Label>
                        <Input
                          type="number"
                          min="60"
                          max="14400"
                          value={form.max_duration_seconds}
                          onChange={(e) =>
                            setForm({ ...form, max_duration_seconds: e.target.value })
                          }
                        />
                        <Description>
                          Hard call ceiling. Vapi default 600 (10 min); we default 600.
                        </Description>
                      </Field>
                    </div>

                    <div className="mt-4">
                      <SwitchTile
                        label="Record calls"
                        description="Stores audio with the call log for later review."
                        checked={form.recording_enabled}
                        onChange={(v) => setForm({ ...form, recording_enabled: v })}
                      />
                    </div>
                  </PanelSection>

                  <PanelSection
                    icon={<ChatBubbleLeftRightIcon className="size-5" />}
                    accent="amber"
                    title="Messaging"
                    subtitle="What the assistant says when ending the call or hitting voicemail."
                  >
                    <div className="mt-4">
                      <SwitchTile
                        label="Voicemail detection"
                        description="Uses Vapi to detect voicemail and hang up (or play your voicemail message)."
                        checked={form.voicemail_detection_enabled}
                        onChange={(v) =>
                          setForm({ ...form, voicemail_detection_enabled: v })
                        }
                      />
                    </div>

                    <Field className="mt-4">
                      <Label>Voicemail message</Label>
                      <Input
                        value={form.voicemail_message}
                        onChange={(e) =>
                          setForm({ ...form, voicemail_message: e.target.value })
                        }
                        placeholder="Hi, this is Acme Plumbing — please call us back…"
                      />
                      <Description>
                        Spoken if the call lands in voicemail. Leave empty to hang up silently.
                      </Description>
                    </Field>

                    <Field className="mt-4">
                      <Label>End-call message</Label>
                      <Input
                        value={form.end_call_message}
                        onChange={(e) =>
                          setForm({ ...form, end_call_message: e.target.value })
                        }
                        placeholder={DEFAULT_FALLBACKS.end_call_message}
                      />
                      <Description>
                        Spoken right before the assistant hangs up.
                      </Description>
                    </Field>
                  </PanelSection>
                </Tab.Panel>
                </fieldset>
              </Tab.Panels>
            </Tab.Group>

            {/* Bottom save bar — mirrors the hero action so users editing
                the long Advanced tab don't have to scroll back to the top. */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">
                Changes are saved locally as you type.{' '}
                <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-zinc-800">
                  Ctrl+Z
                </kbd>{' '}
                undoes any field. Click <strong>Save &amp; sync</strong> to publish to Vapi.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {config.assistant_id && (
                  <Button outline onClick={deleteAssistant} disabled={readOnly}>
                    <TrashIcon data-slot="icon" />
                    Delete on Vapi
                  </Button>
                )}
                <Button onClick={saveAndSync} disabled={syncing || readOnly}>
                  <CloudArrowUpIcon
                    data-slot="icon"
                    className={syncing ? 'animate-spin' : ''}
                  />
                  {syncing
                    ? 'Syncing…'
                    : config.assistant_id
                    ? 'Save & sync'
                    : 'Save & create assistant'}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Phone numbers (only when assistant exists) */}
      {platformReady && config.assistant_id && (
        <Card className="mt-6 mb-8">
          <CardBody>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 ring-1 ring-brand-500/20 dark:text-brand-400">
                  <PhoneIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <Subheading>Phone numbers</Subheading>
                  <Text className="mt-1 text-sm">
                    Bind a Vapi phone number to your assistant so inbound calls reach this
                    tenant.
                  </Text>
                </div>
              </div>
              <Button outline onClick={loadPhones} disabled={phonesLoading}>
                <ArrowPathIcon
                  data-slot="icon"
                  className={phonesLoading ? 'animate-spin' : ''}
                />
                {phones === null ? 'Load' : 'Refresh'}
              </Button>
            </div>

            {/* Free Vapi test number — quick way to get a working number without
                buying one. US-only, limited quantity, meant for testing. */}
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Get a free test number
                  </p>
                  <Text className="mt-0.5 text-xs">
                    Vapi provides free US numbers for testing (call limits apply). Enter a US
                    area code and we&apos;ll create one and connect it to your assistant.
                  </Text>
                </div>
                <div className="flex items-end gap-2">
                  <Field>
                    <Label className="sr-only">US area code</Label>
                    <Input
                      value={freeAreaCode}
                      onChange={(e) => setFreeAreaCode(e.target.value)}
                      placeholder="415"
                      inputMode="numeric"
                      maxLength={3}
                      className="w-24"
                    />
                  </Field>
                  <Button onClick={createFreeNumber} disabled={creatingFree || readOnly}>
                    <PhoneIcon data-slot="icon" className={creatingFree ? 'animate-pulse' : ''} />
                    {creatingFree ? 'Creating…' : 'Create free number'}
                  </Button>
                </div>
              </div>

              {/* Pick an existing free number already in the account instead of
                  creating a new one. Only unclaimed Vapi numbers are listed. */}
              {availableFreeNumbers.length > 0 && (
                <div className="mt-4 border-t border-sky-200/70 pt-4 dark:border-sky-900/50">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Or connect an existing free number
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <Field className="min-w-56 flex-1">
                      <Label className="sr-only">Available free numbers</Label>
                      <Select
                        value={selectedFreeId}
                        onChange={(e) => setSelectedFreeId(e.target.value)}
                      >
                        <option value="">Select a free number…</option>
                        {availableFreeNumbers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.number || p.id}
                            {p.name ? ` · ${p.name}` : ''}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      onClick={() => selectedFreeId && attachPhone(selectedFreeId)}
                      disabled={!selectedFreeId || pendingPhoneId === selectedFreeId || readOnly}
                    >
                      {pendingPhoneId === selectedFreeId ? 'Connecting…' : 'Connect'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Import a customer-owned Twilio or Telnyx number. Creds go to Vapi
                only; we bind Server URL (no static assistant) so calls hit our gate. */}
            <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Import paid number
              </p>
              <Text className="mt-0.5 text-xs">
                Ask the customer to buy a number in Twilio or Telnyx, then paste the number and
                credentials here. We import it into Vapi and route inbound calls through your
                server (no static assistant bind). Credentials are not stored in our database.
              </Text>
              <div className="mt-3 inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                {(['twilio', 'telnyx'] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setPaidProvider(provider)}
                    disabled={readOnly || importingTwilio || importingTelnyx}
                    className={clsx(
                      'rounded-md px-3 py-1.5 text-sm font-semibold capitalize disabled:opacity-50',
                      paidProvider === provider
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
                    )}
                  >
                    {provider === 'twilio' ? 'Twilio' : 'Telnyx'}
                  </button>
                ))}
              </div>
              {paidProvider === 'twilio' ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field>
                      <Label>Phone number</Label>
                      <Input
                        value={twilioNumber}
                        onChange={(e) => setTwilioNumber(e.target.value)}
                        placeholder="+14155551234"
                        autoComplete="off"
                      />
                    </Field>
                    <Field>
                      <Label>Label (optional)</Label>
                      <Input
                        value={twilioName}
                        onChange={(e) => setTwilioName(e.target.value)}
                        placeholder="Main line"
                        autoComplete="off"
                      />
                    </Field>
                    <Field>
                      <Label>Twilio Account SID</Label>
                      <Input
                        value={twilioAccountSid}
                        onChange={(e) => setTwilioAccountSid(e.target.value)}
                        placeholder="ACxxxxxxxx…"
                        autoComplete="off"
                      />
                    </Field>
                    <Field>
                      <Label>Twilio Auth Token</Label>
                      <Input
                        type="password"
                        value={twilioAuthToken}
                        onChange={(e) => setTwilioAuthToken(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Button onClick={importTwilioNumber} disabled={importingTwilio || readOnly}>
                      <PhoneIcon data-slot="icon" className={importingTwilio ? 'animate-pulse' : ''} />
                      {importingTwilio ? 'Importing…' : 'Import Twilio number'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Text className="mt-3 text-xs">
                    The number must already exist in the Telnyx account. Outbound calling also
                    needs an Outbound Voice Profile in the Telnyx portal (not configured here).
                  </Text>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field>
                      <Label>Phone number</Label>
                      <Input
                        value={telnyxNumber}
                        onChange={(e) => setTelnyxNumber(e.target.value)}
                        placeholder="+14155551234"
                        autoComplete="off"
                      />
                    </Field>
                    <Field>
                      <Label>Label (optional)</Label>
                      <Input
                        value={telnyxName}
                        onChange={(e) => setTelnyxName(e.target.value)}
                        placeholder="Main line"
                        autoComplete="off"
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <Label>Telnyx API key</Label>
                      <Input
                        type="password"
                        value={telnyxApiKey}
                        onChange={(e) => setTelnyxApiKey(e.target.value)}
                        placeholder="KEY••••••••"
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Button onClick={importTelnyxNumber} disabled={importingTelnyx || readOnly}>
                      <PhoneIcon data-slot="icon" className={importingTelnyx ? 'animate-pulse' : ''} />
                      {importingTelnyx ? 'Importing…' : 'Import Telnyx number'}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {phones === null ? (
              <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/40 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
                Click <em>Load</em> to fetch the phone numbers in your Vapi account.
              </div>
            ) : phones.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/40 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
                No phone numbers found in this Vapi account. Provision one in the Vapi dashboard,
                then refresh.
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Table>
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
                      // Numbers now bind via the Server URL pattern (no static
                      // assistant), so our number is identified by the stored
                      // phone_number_id, not by assistant_id.
                      const boundToUs = p.id === config.phone_number_id
                      const boundToOther =
                        !boundToUs && Boolean(p.assistant_id)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium tabular-nums">
                            {p.number || '—'}
                          </TableCell>
                          <TableCell>{p.name || '—'}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {p.provider || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {boundToUs ? (
                              <Badge color="lime">
                                <CheckCircleIcon data-slot="icon" />
                                This assistant
                              </Badge>
                            ) : boundToOther ? (
                              <code className="text-xs text-zinc-500">{p.assistant_id}</code>
                            ) : (
                              <span className="text-zinc-400">unbound</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {boundToUs ? (
                              <Button
                                outline
                                onClick={() => detachPhone(p.id)}
                                disabled={pendingPhoneId === p.id || readOnly}
                              >
                                Detach
                              </Button>
                            ) : (
                              <Button
                                onClick={() => attachPhone(p.id)}
                                disabled={pendingPhoneId === p.id || readOnly}
                              >
                                Bind
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatusPill — animated dot + label, used in the hero
// ---------------------------------------------------------------------------

function StatusPill({
  color,
  label,
}: {
  color: 'lime' | 'amber' | 'zinc' | 'red'
  label: string
}) {
  const tone: Record<typeof color, { ring: string; dot: string; text: string; bg: string }> = {
    lime: {
      ring: 'ring-brand-500/30',
      dot: 'bg-brand-500',
      text: 'text-brand-700 dark:text-brand-300',
      bg: 'bg-brand-50 dark:bg-brand-950/40',
    },
    amber: {
      ring: 'ring-amber-500/30',
      dot: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    red: {
      ring: 'ring-rose-500/30',
      dot: 'bg-rose-500',
      text: 'text-rose-700 dark:text-rose-300',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
    },
    zinc: {
      ring: 'ring-zinc-400/30',
      dot: 'bg-zinc-400',
      text: 'text-zinc-700 dark:text-zinc-300',
      bg: 'bg-zinc-100 dark:bg-zinc-800/60',
    },
  }
  const t = tone[color]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        t.bg,
        t.ring,
        t.text,
      )}
    >
      <span className="relative flex size-2">
        {color === 'lime' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
        )}
        <span className={clsx('relative inline-flex size-2 rounded-full', t.dot)} />
      </span>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// HeroStat — one tile in the stats strip under the page title
// ---------------------------------------------------------------------------

const HERO_STAT_ACCENTS = {
  sky: 'bg-sky-500/10 ring-sky-500/20',
  brand: 'bg-brand-500/10 ring-brand-500/20',
  violet: 'bg-violet-500/10 ring-violet-500/20',
} as const

function HeroStat({
  icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  accent: keyof typeof HERO_STAT_ACCENTS
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/60 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
      <div
        className={clsx(
          'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
          HERO_STAT_ACCENTS[accent],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <div className="mt-0.5 break-all text-sm text-zinc-900 dark:text-zinc-100">
          {value}
        </div>
        {hint && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CopyButton — clipboard helper used by the webhook card
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      notifyError('Could not access clipboard.')
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5 text-brand-600 dark:text-brand-400" />
          Copied
        </>
      ) : (
        <>
          <ClipboardDocumentIcon className="size-3.5" />
          Copy
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// PanelSection — visually grouped sub-card inside a tab panel.
// ---------------------------------------------------------------------------
//
// Each panel section has a tinted icon header, title, optional subtitle and
// an optional right-aligned extra (links, badges, action buttons). The body
// gets generous padding and a subtle top border so the eye separates the
// header from the form content without a strong visual break.

const PANEL_ACCENTS: Record<
  string,
  { iconBg: string; iconText: string; iconRing: string }
> = {
  sky: {
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-600 dark:text-sky-400',
    iconRing: 'ring-sky-500/20',
  },
  violet: {
    iconBg: 'bg-violet-500/10',
    iconText: 'text-violet-600 dark:text-violet-400',
    iconRing: 'ring-violet-500/20',
  },
  brand: {
    iconBg: 'bg-brand-500/10',
    iconText: 'text-brand-600 dark:text-brand-400',
    iconRing: 'ring-brand-500/20',
  },
  rose: {
    iconBg: 'bg-rose-500/10',
    iconText: 'text-rose-600 dark:text-rose-400',
    iconRing: 'ring-rose-500/20',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-600 dark:text-amber-400',
    iconRing: 'ring-amber-500/20',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    iconRing: 'ring-indigo-500/20',
  },
}

function PanelSection({
  icon,
  accent = 'sky',
  title,
  subtitle,
  headerExtra,
  children,
}: {
  icon: React.ReactNode
  accent?: keyof typeof PANEL_ACCENTS
  title: string
  subtitle?: React.ReactNode
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  const a = PANEL_ACCENTS[accent] ?? PANEL_ACCENTS.sky
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={clsx(
              'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1',
              a.iconBg,
              a.iconText,
              a.iconRing,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
            )}
          </div>
        </div>
        {headerExtra && <div className="shrink-0">{headerExtra}</div>}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// SwitchTile — boxed switch row (used for binary settings on the Transcriber
// and Advanced tabs). Visually uniform with the rest of the panel cards.
// ---------------------------------------------------------------------------

function SwitchTile({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-xl border p-4 transition-colors',
        checked
          ? 'border-brand-300 bg-brand-50/50 dark:border-brand-800/60 dark:bg-brand-950/20'
          : 'border-zinc-200 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ResetButton — small "Reset to default" link used near textareas/inputs.
// ---------------------------------------------------------------------------

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-sky-600 transition hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
    >
      <SparklesIcon className="size-3.5" />
      Reset to default
    </button>
  )
}

// ---------------------------------------------------------------------------
// SliderField — labelled <input type=range> + numeric readout.
// ---------------------------------------------------------------------------
//
// Empty value === "use provider default", so we render the slider at its
// midpoint visually (via the `placeholder`) but keep the form value as ''.
// The parent only writes the field onto the voice object when the user
// actually moved the slider (parseNumberOr handles that contract).

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  step: number
  placeholder: string
  hint?: string
}) {
  const numeric = value.trim() === '' ? Number(placeholder) : Number(value)
  const safe = Number.isFinite(numeric) ? Math.min(Math.max(numeric, min), max) : Number(placeholder)
  return (
    <Field>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-zinc-500">
          {value.trim() === '' ? `default · ${placeholder}` : Number(value).toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-sky-500 dark:bg-zinc-700"
      />
      {hint ? <Description>{hint}</Description> : null}
      {value.trim() !== '' && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Reset to default
        </button>
      )}
    </Field>
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

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MicrophoneIcon,
  StopCircleIcon,
  UserMinusIcon,
} from '@heroicons/react/24/outline'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Button } from '@/components/button'
import { Textarea } from '@/components/textarea'

export type BookingAction = 'complete' | 'no-show' | 'cancel'

const COPY: Record<
  BookingAction,
  {
    title: string
    description: string
    confirmLabel: string
    busyLabel: string
    color: 'green' | 'amber' | 'red'
    icon: typeof CheckCircleIcon
    iconBg: string
    iconRing: string
    iconText: string
    notePlaceholder: string
  }
> = {
  complete: {
    title: 'Mark booking as completed',
    description:
      'Confirm the visit happened. You can attach a short note (typed or dictated) — totally optional.',
    confirmLabel: 'Confirm complete',
    busyLabel: 'Saving…',
    color: 'green',
    icon: CheckCircleIcon,
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    iconRing: 'ring-emerald-200 dark:ring-emerald-500/30',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    notePlaceholder: 'e.g. Replaced compressor, customer happy.',
  },
  'no-show': {
    title: 'Mark as no-show',
    description:
      'Customer did not show up. Add an optional note for the team (or skip and confirm).',
    confirmLabel: 'Confirm no-show',
    busyLabel: 'Saving…',
    color: 'amber',
    icon: UserMinusIcon,
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconRing: 'ring-amber-200 dark:ring-amber-500/30',
    iconText: 'text-amber-600 dark:text-amber-400',
    notePlaceholder: 'e.g. Tried twice, no answer.',
  },
  cancel: {
    title: 'Cancel this booking',
    description:
      'This will release the slot and remove the calendar event when linked. Add an optional reason.',
    confirmLabel: 'Confirm cancellation',
    busyLabel: 'Cancelling…',
    color: 'red',
    icon: ExclamationTriangleIcon,
    iconBg: 'bg-red-50 dark:bg-red-500/10',
    iconRing: 'ring-red-200 dark:ring-red-500/30',
    iconText: 'text-red-600 dark:text-red-400',
    notePlaceholder: 'e.g. Customer rescheduled by phone.',
  },
}

interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionErrorEventLike {
  error?: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Modal asking the operator to confirm a booking status transition. They can
 * leave a free-text note (typed or dictated via the browser's SpeechRecognition
 * API) or just hit "Confirm" without one.
 *
 * The Confirm button is always enabled — notes are optional by design.
 */
export function BookingStatusDialog({
  open,
  action,
  customerName,
  onClose,
  onConfirm,
}: {
  open: boolean
  action: BookingAction
  customerName?: string
  onClose: () => void
  onConfirm: (note: string) => Promise<void> | void
}) {
  const copy = COPY[action]
  const Icon = copy.icon

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseNoteRef = useRef<string>('')

  const speechSupported = typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null

  useEffect(() => {
    if (!open) {
      setNote('')
      setBusy(false)
      setListening(false)
      setVoiceError(null)
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore — happens when stop is called twice
      }
      recognitionRef.current = null
    }
  }, [open])

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        // ignore
      }
    }
  }, [])

  const startListening = () => {
    setVoiceError(null)
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setVoiceError('Voice input is not supported in this browser.')
      return
    }
    try {
      const rec = new Ctor()
      rec.lang = navigator.language || 'en-US'
      rec.continuous = true
      rec.interimResults = true
      baseNoteRef.current = note ? note.trimEnd() + ' ' : ''
      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let final = ''
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]
          const text = r[0]?.transcript ?? ''
          if (r.isFinal) {
            final += text
          } else {
            interim += text
          }
        }
        setNote((baseNoteRef.current + final + interim).trimStart())
        if (final) {
          baseNoteRef.current = (baseNoteRef.current + final).trimStart() + ' '
        }
      }
      rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const code = event.error || 'unknown'
        if (code === 'no-speech') {
          setVoiceError(null)
        } else if (code === 'not-allowed' || code === 'service-not-allowed') {
          setVoiceError('Microphone permission was denied. Allow it in your browser settings.')
        } else {
          setVoiceError('Could not capture voice. Try again or type your note.')
        }
        setListening(false)
      }
      rec.onend = () => setListening(false)
      recognitionRef.current = rec
      rec.start()
      setListening(true)
    } catch {
      setVoiceError('Could not start voice input.')
      setListening(false)
    }
  }

  const stopListening = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
    setListening(false)
  }

  const handleConfirm = async () => {
    if (busy) return
    if (listening) stopListening()
    setBusy(true)
    try {
      await onConfirm(note.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${copy.iconBg} ${copy.iconRing}`}
        >
          <Icon className={`h-5 w-5 ${copy.iconText}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <DialogTitle className="mt-0!">{copy.title}</DialogTitle>
          <DialogDescription className="mt-1!">
            {copy.description}
            {customerName && (
              <>
                {' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{customerName}</span>
              </>
            )}
          </DialogDescription>
        </div>
      </div>

      <DialogBody>
        <label className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span>
            Note <span className="text-zinc-400">(optional)</span>
          </span>
          {speechSupported && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                listening
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15'
              }`}
              aria-pressed={listening}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              title={listening ? 'Stop dictation' : 'Dictate with microphone'}
            >
              {listening ? (
                <>
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  <StopCircleIcon className="h-4 w-4" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <MicrophoneIcon className="h-4 w-4" aria-hidden="true" />
                  Dictate
                </>
              )}
            </button>
          )}
        </label>
        <Textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={copy.notePlaceholder}
          disabled={busy}
        />
        {listening && (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Listening… speak now
          </p>
        )}
        {voiceError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{voiceError}</p>
        )}
        {!speechSupported && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Voice dictation isn&apos;t available in this browser — type your note above instead.
          </p>
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button color={copy.color} onClick={handleConfirm} disabled={busy}>
          {busy ? copy.busyLabel : copy.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

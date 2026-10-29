'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ClockIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, CheckIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { useReadOnlyAccount } from '@/components/account-status-gate'
import { ApiError, api } from '@/lib/api'
import { useApiToken, useFreshOrgToken } from '@/lib/hooks'
import { notifyError, notifySuccess } from '@/lib/notify'

type CalendarStatus = {
  connected: boolean
  email: string
  needs_reconnect: boolean
  connected_at?: string | null
}

type Notice = { tone: 'ok' | 'err'; text: string }

function noticeFromLocation(): Notice | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const result = params.get('google_calendar')
  if (result === 'connected') return { tone: 'ok', text: 'Google Calendar is connected.' }
  if (result === 'error') {
    return { tone: 'err', text: params.get('message') || 'Google Calendar could not be connected.' }
  }
  return null
}

function formatConnectedOn(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const features = [
  {
    title: 'Automatic Sync',
    text: 'New bookings are added automatically',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Live Updates',
    text: 'Reschedules and cancellations are synced in real-time',
    icon: ArrowPathIcon,
  },
  {
    title: 'Your Data Stays Safe',
    text: 'We only access your calendar events',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Save Time',
    text: 'Keep all your appointments in one place',
    icon: ClockIcon,
  },
]

export function GoogleCalendarCard() {
  const getToken = useApiToken()
  const getFreshToken = useFreshOrgToken()
  const { readOnly } = useReadOnlyAccount()
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [busy, setBusy] = useState<'connect' | 'disconnect' | 'sync' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(noticeFromLocation)

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const row = await api.oauth.googleCalendarStatus(token)
    setStatus(row)
  }, [getToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('google_calendar')
    if (!result) return
    const text =
      result === 'connected'
        ? 'Google Calendar is connected.'
        : params.get('message') || 'Google Calendar could not be connected.'
    if (result === 'connected') notifySuccess(text)
    else notifyError(text)
    params.delete('google_calendar')
    params.delete('message')
    const next = params.toString()
    window.history.replaceState(null, '', next ? `/settings?${next}` : '/settings')
  }, [])

  useEffect(() => {
    load().catch((err) => {
      const text = err instanceof ApiError ? err.message : 'Could not load Google Calendar.'
      setNotice({ tone: 'err', text })
    })
  }, [load])

  const connect = async () => {
    setBusy('connect')
    setNotice(null)
    try {
      const token = await getFreshToken()
      if (!token) {
        throw new Error('Select your client workspace before connecting Google Calendar.')
      }
      const { authorization_url } = await api.oauth.googleCalendarStart(token)
      window.location.assign(authorization_url)
    } catch (err) {
      const text = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not start Google sign-in.'
      setNotice({ tone: 'err', text })
      notifyError(text)
      setBusy(null)
    }
  }

  const disconnect = async () => {
    setBusy('disconnect')
    setNotice(null)
    try {
      const token = await getToken()
      if (!token) return
      await api.oauth.googleCalendarDisconnect(token)
      setStatus({ connected: false, email: '', needs_reconnect: false, connected_at: null })
      const text = 'Google Calendar disconnected. Events already on the calendar stay there.'
      setNotice({ tone: 'ok', text })
      notifySuccess(text)
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Could not disconnect Google Calendar.'
      setNotice({ tone: 'err', text })
      notifyError(text)
    } finally {
      setBusy(null)
    }
  }

  const sync = async () => {
    setBusy('sync')
    setNotice(null)
    try {
      const token = await getToken()
      if (!token) return
      const result = await api.oauth.googleCalendarSync(token)
      const text = `Synced ${result.synced} booking${result.synced === 1 ? '' : 's'}. ${result.skipped} already on the calendar. ${result.failed} failed.`
      setNotice({ tone: result.failed ? 'err' : 'ok', text })
      if (result.failed) notifyError(text)
      else notifySuccess(text)
      await load()
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Could not sync bookings.'
      setNotice({ tone: 'err', text })
      notifyError(text)
    } finally {
      setBusy(null)
    }
  }

  const connected = Boolean(status?.connected)
  const loading = status === null && !notice
  const connectedOn = formatConnectedOn(status?.connected_at)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#e8f1ff] text-[#1a73e8] shadow-sm ring-1 ring-[#d2e3fc]">
            <CalendarDaysIcon className="size-6" />
          </span>
          <div>
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-zinc-950">Google Calendar</h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Connect your Google Calendar to automatically sync your client bookings and keep your schedule up to date.
            </p>
          </div>
        </div>
        <a
          href="https://support.google.com/calendar"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
        >
          <InformationCircleIcon className="size-4" />
          Learn more
          <ArrowTopRightOnSquareIcon className="size-3.5" />
        </a>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#eef4ff] px-6 py-7 shadow-sm ring-1 ring-blue-100 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-16 top-8 size-72 rounded-full bg-[#dbe7ff]" />
          <div className="pointer-events-none absolute bottom-6 right-24 size-40 rounded-full bg-[#e7eeff]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)]">
            <div>
              <span className="inline-flex rounded-full bg-[#dbe8ff] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#1a73e8]">
                Stay Organized
              </span>
              <h3 className="mt-4 max-w-md text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-zinc-950 sm:text-[2.15rem]">
                Sync Your Bookings with
                <span className="mt-1 block text-[#1a73e8]">Google Calendar</span>
              </h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">
                Automatically add, update, and remove your client bookings in Google Calendar. Save time and never miss an appointment.
              </p>
              <ul className="mt-7 space-y-4">
                {features.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#1a73e8] shadow-sm ring-1 ring-blue-100">
                      <item.icon className="size-[18px]" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-zinc-500">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <CalendarPreview />
          </div>
        </section>

        <section
          id="google-calendar-connection"
          className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-zinc-200/80 sm:p-7"
        >
          <h3 className="text-lg font-semibold text-zinc-950">Google Calendar Connection</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Link your Google account to start syncing bookings.
          </p>

          {loading ? (
            <div className="mt-5 space-y-4">
              <div className="h-[4.5rem] animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-12 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-12 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ) : connected ? (
            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#edf8f0] px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-sm">
                    <CheckIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#15803d]">Connected</p>
                    <p className="truncate text-sm text-[#3d8f5a]">{status?.email}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  outline
                  className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={disconnect}
                  disabled={readOnly || busy !== null}
                >
                  <TrashIcon data-slot="icon" />
                  {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>

              <dl className="space-y-0 text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-3.5">
                  <dt className="flex items-center gap-2.5 text-zinc-500">
                    <UserIcon className="size-4" />
                    Google Account
                  </dt>
                  <dd className="truncate font-medium text-zinc-700">{status?.email}</dd>
                </div>
                {connectedOn && (
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <dt className="flex items-center gap-2.5 text-zinc-500">
                      <CalendarDaysIcon className="size-4" />
                      Connected On
                    </dt>
                    <dd className="font-medium text-zinc-700">{connectedOn}</dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-col gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Sync Existing Bookings</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Add all your upcoming confirmed bookings to your Google Calendar.
                  </p>
                </div>
                <Button
                  type="button"
                  color="blue"
                  className="shrink-0"
                  onClick={sync}
                  disabled={readOnly || busy !== null}
                >
                  <ArrowPathIcon data-slot="icon" className={busy === 'sync' ? 'animate-spin' : ''} />
                  {busy === 'sync' ? 'Syncing…' : 'Sync Now'}
                </Button>
              </div>

              <p className="flex gap-2.5 rounded-2xl bg-[#eef5ff] px-3.5 py-3 text-sm leading-5 text-[#1d4ed8]">
                <InformationCircleIcon className="mt-0.5 size-4 shrink-0" />
                Only upcoming confirmed bookings will be synced. Existing calendar events will not be modified.
              </p>

              {notice ? (
                <p
                  className={`flex gap-2.5 rounded-2xl px-3.5 py-3 text-sm leading-5 ${
                    notice.tone === 'ok'
                      ? 'bg-[#edf8f0] text-[#15803d]'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  {notice.tone === 'ok' ? (
                    <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#22c55e]" />
                  ) : (
                    <InformationCircleIcon className="mt-0.5 size-4 shrink-0" />
                  )}
                  {notice.text}
                </p>
              ) : (
                <p className="flex gap-2.5 rounded-2xl bg-[#edf8f0] px-3.5 py-3 text-sm leading-5 text-[#15803d]">
                  <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#22c55e]" />
                  <span>
                    <span className="font-semibold">Everything is working correctly!</span>{' '}
                    Your upcoming bookings will automatically sync to Google Calendar.
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl bg-zinc-50 px-4 py-4 ring-1 ring-zinc-200">
                <p className="text-sm font-semibold text-zinc-800">
                  {status?.needs_reconnect ? 'Reconnect required' : 'Not connected'}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {status?.needs_reconnect
                    ? 'Google access expired or was removed. Connect again to resume sync.'
                    : 'No Google account is linked for this client yet.'}
                </p>
              </div>
              <Button
                type="button"
                color="blue"
                className="w-full"
                onClick={connect}
                disabled={readOnly || busy !== null}
              >
                <CalendarDaysIcon data-slot="icon" />
                {busy === 'connect' ? 'Opening Google…' : 'Connect Google Calendar'}
              </Button>
              <p className="flex gap-2.5 rounded-2xl bg-[#eef5ff] px-3.5 py-3 text-sm leading-5 text-[#1d4ed8]">
                <InformationCircleIcon className="mt-0.5 size-4 shrink-0" />
                Only upcoming confirmed bookings will be synced. Existing calendar events will not be modified.
              </p>
              {notice && (
                <p
                  className={`flex gap-2.5 rounded-2xl px-3.5 py-3 text-sm leading-5 ${
                    notice.tone === 'ok'
                      ? 'bg-[#edf8f0] text-[#15803d]'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  <InformationCircleIcon className="mt-0.5 size-4 shrink-0" />
                  {notice.text}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function CalendarPreview() {
  const days = [
    { label: 'Mon', date: '10' },
    { label: 'Tue', date: '11' },
    { label: 'Wed', date: '12', active: true },
    { label: 'Thu', date: '13' },
    { label: 'Fri', date: '14' },
  ]

  return (
    <div className="relative mx-auto w-full max-w-[17.5rem]">
      <span className="pointer-events-none absolute -left-3 -top-4 z-20" aria-hidden="true">
        <GoogleCalendarMark />
      </span>
      <span className="pointer-events-none absolute -right-1 top-2 z-20 text-[#fbbc05]" aria-hidden="true">
        <Sparkle />
      </span>
      <div className="relative z-10 rounded-[1.4rem] bg-white p-3.5 shadow-[0_18px_40px_rgba(37,99,235,0.12)] ring-1 ring-zinc-200/80">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-zinc-800">Google Calendar</p>
          <span className="text-zinc-400">▾</span>
        </div>
        <div className="grid grid-cols-5 px-1 text-center">
          {days.map((day) => (
            <div key={day.label} className="space-y-1">
              <p className="text-[10px] font-medium text-zinc-400">{day.label}</p>
              <p
                className={
                  day.active
                    ? 'mx-auto flex size-6 items-center justify-center rounded-full bg-[#1a73e8] text-[11px] font-semibold text-white'
                    : 'text-[11px] font-medium text-zinc-700'
                }
              >
                {day.date}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2 text-[11px]">
          <PreviewRow time="9 AM">
            <span className="block rounded-md bg-[#dbeafe] px-2 py-1.5 font-medium leading-4 text-[#1d4ed8]">
              Consultation Call
              <span className="mt-0.5 block text-[10px] font-normal text-[#3b82f6]">9:00 – 9:30 AM</span>
            </span>
          </PreviewRow>
          <PreviewRow time="10 AM">
            <span className="block rounded-md bg-[#dcfce7] px-2 py-1.5 font-medium leading-4 text-[#15803d]">
              Client Onboarding
              <span className="mt-0.5 block text-[10px] font-normal text-[#22c55e]">10:00 – 10:45 AM</span>
            </span>
          </PreviewRow>
          <PreviewRow time="11 AM" />
          <PreviewRow time="12 PM">
            <span className="block rounded-md bg-[#ede9fe] px-2 py-1.5 font-medium leading-4 text-[#6d28d9]">
              Follow Up Meeting
              <span className="mt-0.5 block text-[10px] font-normal text-[#8b5cf6]">12:00 – 12:30 PM</span>
            </span>
          </PreviewRow>
        </div>
      </div>
    </div>
  )
}

function PreviewRow({ time, children }: { time: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.4rem_minmax(0,1fr)] items-start gap-2">
      <span className="pt-1 text-[10px] text-zinc-400">{time}</span>
      <div className="min-h-[1.6rem]">{children}</div>
    </div>
  )
}

function Sparkle() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M10 0c.4 3.6 1.8 6.2 5.4 7.4C11.8 8.6 10.4 11.2 10 14.8 9.6 11.2 8.2 8.6 4.6 7.4 8.2 6.2 9.6 3.6 10 0Z" />
    </svg>
  )
}

function GoogleCalendarMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[3.4rem] drop-shadow-md" aria-hidden="true">
      <defs>
        <clipPath id="gcal-mark">
          <rect x="3" y="4" width="42" height="40" rx="9" />
        </clipPath>
      </defs>
      <rect x="3" y="4" width="42" height="40" rx="9" fill="#fff" />
      <g clipPath="url(#gcal-mark)">
        <rect x="3" y="4" width="10.5" height="10" fill="#4285F4" />
        <rect x="13.5" y="4" width="10.5" height="10" fill="#34A853" />
        <rect x="24" y="4" width="10.5" height="10" fill="#FBBC05" />
        <rect x="34.5" y="4" width="10.5" height="10" fill="#EA4335" />
      </g>
      <rect x="3" y="4" width="42" height="40" rx="9" fill="none" stroke="#e5e7eb" />
      <text
        x="24"
        y="36"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="#1a73e8"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        31
      </text>
    </svg>
  )
}

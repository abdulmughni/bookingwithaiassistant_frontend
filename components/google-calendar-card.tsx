'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/button'
import { dashCardClass } from '@/components/dashboard-ui'
import { useReadOnlyAccount } from '@/components/account-status-gate'
import { ApiError, api } from '@/lib/api'
import { useApiToken, useFreshOrgToken } from '@/lib/hooks'
import { notifyError, notifySuccess } from '@/lib/notify'

type CalendarStatus = {
  connected: boolean
  email: string
  needs_reconnect: boolean
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

const features = [
  {
    title: 'Automatic sync',
    text: 'A confirmed booking is added to this Google Calendar.',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Live updates',
    text: 'Reschedules move the event. Cancellations remove it.',
    icon: ArrowPathIcon,
  },
  {
    title: 'Your data stays safe',
    text: 'Only this client’s calendar is used. Google tokens stay on the server.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Save time',
    text: 'Upcoming confirmed bookings can be copied in one sync.',
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
      setStatus({ connected: false, email: '', needs_reconnect: false })
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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
          <CalendarMark />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Google Calendar</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Connect this client’s Google Calendar so confirmed bookings are added, updated, and removed automatically.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="order-2 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-6 shadow-sm sm:p-8 lg:order-1">
          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
            Stay organized
          </span>
          <h3 className="mt-4 max-w-md text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Sync your bookings with Google Calendar
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">
            Confirmed appointments from this account are copied to the connected Google Calendar. The booking record here stays the source of truth.
          </p>
          <ul className="mt-6 space-y-4">
            {features.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                  <item.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-zinc-500">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <ExampleCalendar />
        </section>

        <section className={`${dashCardClass} order-1 p-5 sm:p-6 lg:order-2`}>
          <h3 className="text-base font-semibold text-zinc-950">Google Calendar connection</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Link the Google account that should receive this client’s bookings.
          </p>

          {loading ? (
            <div className="mt-5 space-y-3">
              <div className="h-16 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ) : connected ? (
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="flex min-w-0 items-center gap-3">
                  <CheckCircleIcon className="size-8 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">Connected</p>
                    <p className="truncate text-sm text-emerald-700">{status?.email || 'Google account connected'}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  outline
                  className="text-red-600"
                  onClick={disconnect}
                  disabled={readOnly || busy !== null}
                >
                  {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                  <dt className="text-zinc-500">Google account</dt>
                  <dd className="truncate font-medium text-zinc-900">{status?.email || 'Connected'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="font-medium text-emerald-700">Connected</dd>
                </div>
              </dl>

              <div className="border-t border-zinc-100 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Sync existing bookings</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Copy upcoming confirmed bookings that are not on the calendar yet.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  outline
                  className="mt-4 w-full sm:w-auto"
                  onClick={sync}
                  disabled={readOnly || busy !== null}
                >
                  <ArrowPathIcon data-slot="icon" className={busy === 'sync' ? 'animate-spin' : ''} />
                  {busy === 'sync' ? 'Syncing…' : 'Sync Existing Bookings'}
                </Button>
                <p className="mt-4 flex gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-sm text-blue-800 ring-1 ring-blue-100">
                  <CalendarDaysIcon className="mt-0.5 size-4 shrink-0" />
                  Only upcoming confirmed bookings are synced. Events already on the calendar are left as they are.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
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
                className="w-full sm:w-auto"
                onClick={connect}
                disabled={readOnly || busy !== null}
              >
                <CalendarDaysIcon data-slot="icon" />
                {busy === 'connect' ? 'Opening Google…' : 'Connect Google Calendar'}
              </Button>
            </div>
          )}

          {notice && (
            <p
              className={`mt-4 rounded-2xl px-3 py-2 text-sm ${
                notice.tone === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  : 'bg-red-50 text-red-800 ring-1 ring-red-200'
              }`}
            >
              {notice.text}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function CalendarMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <rect x="4" y="6" width="24" height="22" rx="4" fill="#fff" stroke="#d4d4d8" />
      <path d="M4 12h24" stroke="#d4d4d8" />
      <rect x="8" y="4" width="3" height="5" rx="1" fill="#4285F4" />
      <rect x="21" y="4" width="3" height="5" rx="1" fill="#4285F4" />
      <rect x="8" y="16" width="6" height="4" rx="1" fill="#4285F4" />
      <rect x="16" y="16" width="6" height="4" rx="1" fill="#34A853" />
      <rect x="8" y="22" width="6" height="3" rx="1" fill="#FBBC05" />
      <rect x="16" y="22" width="6" height="3" rx="1" fill="#EA4335" />
    </svg>
  )
}

function ExampleCalendar() {
  return (
    <div className="mt-8 rounded-3xl bg-white p-4 shadow-md ring-1 ring-zinc-200/80 sm:ml-auto sm:max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">Example</p>
        <span className="text-xs text-zinc-400">How an event looks</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[11px] text-zinc-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <div className="rounded-xl bg-blue-100 px-3 py-2 text-xs font-medium text-blue-800">9:00 · Service appointment</div>
        <div className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-800">10:30 · Follow-up visit</div>
        <div className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-medium text-violet-800">12:00 · Confirmed booking</div>
      </div>
    </div>
  )
}

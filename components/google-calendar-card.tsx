'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { dashCardClass } from '@/components/dashboard-ui'
import { Subheading } from '@/components/heading'
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

export function GoogleCalendarCard() {
  const getToken = useApiToken()
  const getFreshToken = useFreshOrgToken()
  const { readOnly } = useReadOnlyAccount()
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [busy, setBusy] = useState<'connect' | 'disconnect' | 'sync' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const row = await api.oauth.googleCalendarStatus(token)
    setStatus(row)
  }, [getToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('google_calendar')
    if (result === 'connected') {
      const text = 'Google Calendar is connected.'
      setNotice({ tone: 'ok', text })
      notifySuccess(text)
    } else if (result === 'error') {
      const text = params.get('message') || 'Google Calendar could not be connected.'
      setNotice({ tone: 'err', text })
      notifyError(text)
    }
    if (result) {
      params.delete('google_calendar')
      params.delete('message')
      const next = params.toString()
      window.history.replaceState(null, '', next ? `/settings?${next}` : '/settings')
    }
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

  return (
    <section className={`${dashCardClass} p-5`}>
      <Subheading>Google Calendar</Subheading>
      <p className="mt-1 text-sm text-zinc-500">
        Connect this client&apos;s Google account. Confirmed bookings are added to that calendar.
        Reschedules update the event, and cancellations remove it.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {connected ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            Connected{status?.email ? ` · ${status.email}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
            {status?.needs_reconnect ? 'Reconnect required' : 'Not connected'}
          </span>
        )}
      </div>

      {notice && (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            notice.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-red-50 text-red-800 ring-1 ring-red-200'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button type="button" outline onClick={sync} disabled={readOnly || busy !== null}>
              {busy === 'sync' ? 'Syncing…' : 'Sync Existing Bookings'}
            </Button>
            <Button type="button" outline onClick={disconnect} disabled={readOnly || busy !== null}>
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </>
        ) : (
          <Button type="button" color="blue" onClick={connect} disabled={readOnly || busy !== null}>
            {busy === 'connect' ? 'Opening Google…' : 'Connect Google Calendar'}
          </Button>
        )}
      </div>
    </section>
  )
}

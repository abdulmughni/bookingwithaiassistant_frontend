'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { dashCardClass } from '@/components/dashboard-ui'
import { ApiError, api } from '@/lib/api'
import { useApiData, useApiToken } from '@/lib/hooks'
import type { SetupRequest } from '@/lib/types'

const STATUS_LABEL: Record<SetupRequest['status'], string> = {
  requested: 'Requested',
  configuring: 'Configuring',
  testing: 'Testing',
  ready: 'Ready for activation',
}

export function SetupRequestCard({
  tenantId,
  canRequest,
  canEdit,
}: {
  tenantId: string
  canRequest: boolean
  canEdit: boolean
}) {
  const getToken = useApiToken()
  const { data, loading, error, refetch } = useApiData(
    (token) => api.admin.getSetupRequest(token, tenantId),
    [tenantId],
  )
  const [busy, setBusy] = useState(false)
  const [fee, setFee] = useState('')

  async function requestSetup() {
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.requestSetup(token, tenantId)
      toast.success('Setup requested')
      await refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not request setup.')
    } finally {
      setBusy(false)
    }
  }

  async function save(next: { status?: string; setup_fee_cents?: number }) {
    setBusy(true)
    try {
      const token = await getToken()
      await api.admin.updateSetupRequest(token, tenantId, next)
      toast.success('Setup updated')
      await refetch()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update setup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${dashCardClass} p-5`}>
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">AI setup</h2>
      <p className="mt-1 text-sm text-zinc-500">
        The platform configures and tests the assistant. Ready does not turn the client live.
        A platform admin still has to activate the account.
      </p>
      {loading ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {!loading && !data && canRequest ? (
        <Button className="mt-4" color="brand" disabled={busy} onClick={() => void requestSetup()}>
          {busy ? 'Requesting…' : 'Request AI setup'}
        </Button>
      ) : null}
      {!loading && !data && !canRequest ? (
        <p className="mt-3 text-sm text-zinc-500">No setup request yet.</p>
      ) : null}
      {data ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            Status: <span className="font-medium">{STATUS_LABEL[data.status]}</span>
            {data.setup_fee_cents != null
              ? ` · Setup fee recorded $${(data.setup_fee_cents / 100).toLocaleString()}`
              : ''}
          </p>
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-3">
              <Select
                aria-label="Setup status"
                value={data.status}
                disabled={busy}
                onChange={(event) => void save({ status: event.target.value })}
              >
                <option value="requested">Requested</option>
                <option value="configuring">Configuring</option>
                <option value="testing">Testing</option>
                <option value="ready">Ready for activation</option>
              </Select>
              <Input
                className="max-w-40"
                inputMode="decimal"
                placeholder="Setup fee USD"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
              />
              <Button
                outline
                disabled={busy || fee.trim() === ''}
                onClick={() => {
                  const dollars = Number(fee)
                  if (!Number.isFinite(dollars) || dollars < 0) {
                    toast.error('Enter a fee amount.')
                    return
                  }
                  void save({ setup_fee_cents: Math.round(dollars * 100) })
                }}
              >
                Record fee
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

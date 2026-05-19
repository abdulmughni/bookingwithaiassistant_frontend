'use client'

import { useCallback, useEffect, useState } from 'react'
import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
import { Input } from '@/components/input'
import { Text } from '@/components/text'
import { TagInput } from '@/components/tag-input'
import { ApiError, api } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { CrmSettings, JobberTechnician } from '@/lib/types'

export interface JobberCrmSettingsProps {
  value: CrmSettings
  onChange: (next: CrmSettings) => void
  jobberConnected: boolean
  getToken: () => Promise<string>
  serviceTypes: string[]
}

const DEFAULT_CRM_SETTINGS: CrmSettings = {
  auto_assign_technician: false,
  arrival_window_minutes: 120,
  technician_expertise: {},
}

export function parseCrmSettings(raw: Record<string, unknown> | null | undefined): CrmSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CRM_SETTINGS, technician_expertise: {} }
  }
  const exp = raw.technician_expertise
  const expertise: Record<string, string[]> = {}
  if (exp && typeof exp === 'object') {
    for (const [uid, skills] of Object.entries(exp)) {
      if (Array.isArray(skills)) {
        expertise[uid] = skills.map((s) => String(s).trim()).filter(Boolean)
      }
    }
  }
  let arrival = 120
  if (typeof raw.arrival_window_minutes === 'number') {
    arrival = raw.arrival_window_minutes
  } else if (typeof raw.arrival_window_minutes === 'string') {
    const n = parseInt(raw.arrival_window_minutes, 10)
    if (!Number.isNaN(n)) arrival = n
  }
  return {
    auto_assign_technician: Boolean(raw.auto_assign_technician),
    arrival_window_minutes: arrival,
    technician_expertise: expertise,
  }
}

export function JobberCrmSettings({
  value,
  onChange,
  jobberConnected,
  getToken,
  serviceTypes,
}: JobberCrmSettingsProps) {
  const [technicians, setTechnicians] = useState<JobberTechnician[]>([])
  const [loadingTechs, setLoadingTechs] = useState(false)

  const loadTechnicians = useCallback(async () => {
    if (!jobberConnected) {
      setTechnicians([])
      return
    }
    setLoadingTechs(true)
    try {
      const token = await getToken()
      const rows = await api.tenants.jobberTechnicians(token)
      setTechnicians(rows)
    } catch (e) {
      setTechnicians([])
      if (e instanceof ApiError && e.status === 400) {
        return
      }
      notifyError(
        e instanceof ApiError ? e.message : 'Could not load Jobber technicians',
      )
    } finally {
      setLoadingTechs(false)
    }
  }, [getToken, jobberConnected])

  useEffect(() => {
    void loadTechnicians()
  }, [loadTechnicians])

  const expertise = value.technician_expertise || {}

  const setExpertiseFor = (userId: string, skills: string[]) => {
    onChange({
      ...value,
      technician_expertise: { ...expertise, [userId]: skills },
    })
  }

  const skillHints =
    serviceTypes.length > 0
      ? serviceTypes.slice(0, 6).join(', ')
      : 'AC repair, furnace, water heater'

  return (
    <div className="mt-4 rounded-xl border border-lime-200/80 bg-lime-50/40 p-5 dark:border-lime-900/50 dark:bg-lime-950/20">
      <Text className="text-sm font-medium text-zinc-900 dark:text-white">Jobber scheduling</Text>
      <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Controls how AI bookings sync to Jobber and how technicians are chosen.
        {!jobberConnected && (
          <>
            {' '}
            Select <strong>Jobber</strong> as CRM and connect OAuth on{' '}
            <strong>Integrations</strong> to enable these options.
          </>
        )}
      </Text>

      <FieldGroup className="mt-6">
        <Field>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(value.auto_assign_technician)}
              onChange={(e) =>
                onChange({ ...value, auto_assign_technician: e.target.checked })
              }
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900 dark:text-white">
                Auto-assign technician in Jobber
              </span>
              <Description className="mt-0.5">
                When on, new AI bookings pick a free Jobber user for the slot using
                expertise below. When off, jobs are created unassigned — you assign in
                Jobber.
              </Description>
            </span>
          </label>
        </Field>

        <Field>
          <Label>Arrival window (minutes)</Label>
          <Description>
            Customer arrival window in Jobber (<code className="text-xs">startAt</code> →{' '}
            <code className="text-xs">endAt</code>). Default 120 minutes.
          </Description>
          <Input
            type="number"
            min={15}
            max={480}
            step={15}
            value={String(value.arrival_window_minutes ?? 120)}
            onChange={(e) =>
              onChange({
                ...value,
                arrival_window_minutes: parseInt(e.target.value, 10) || 120,
              })
            }
          />
        </Field>
      </FieldGroup>

      <hr className="my-6 border-zinc-200 dark:border-zinc-700" />

      <Text className="text-sm font-medium text-zinc-900 dark:text-white">
        Technician expertise
      </Text>
      <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {jobberConnected
          ? 'Map each Jobber user to service keywords. Auto-assign prefers technicians whose skills match the booked service.'
          : 'Connect Jobber on Integrations to load your team.'}
      </Text>

      {jobberConnected ? (
        loadingTechs ? (
          <Text className="mt-4 text-sm text-zinc-500">Loading technicians from Jobber…</Text>
        ) : technicians.length === 0 ? (
          <Text className="mt-4 text-sm text-zinc-500">
            No active Jobber users found. Activate team members in Jobber, then refresh.
          </Text>
        ) : (
          <div className="mt-4 space-y-5">
            {technicians.map((tech) => (
              <Field key={tech.id}>
                <TagInput
                  label={tech.name || 'Technician'}
                  description={`Keywords for matching (e.g. ${skillHints}).`}
                  value={expertise[tech.id] || []}
                  onChange={(tags) => setExpertiseFor(tech.id, tags)}
                  placeholder="AC, furnace, install"
                />
              </Field>
            ))}
            <button
              type="button"
              onClick={() => void loadTechnicians()}
              className="text-sm text-lime-700 underline-offset-2 hover:underline dark:text-lime-400"
            >
              Refresh technician list from Jobber
            </button>
          </div>
        )
      ) : null}
    </div>
  )
}

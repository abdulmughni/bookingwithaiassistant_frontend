'use client'

import { useEffect, useMemo, useState } from 'react'
import { Heading, Subheading } from '@/components/heading'
import { Button } from '@/components/button'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Textarea } from '@/components/textarea'
import { Badge } from '@/components/badge'
import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
import { TagInput } from '@/components/tag-input'
import { WorkingHoursEditor } from '@/components/working-hours-editor'
import { useApiData, useApiToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Credential, PromptConfig, Tenant } from '@/lib/types'
import { DocumentsTab } from './documents-tab'
import { IanaTimezoneField } from '@/components/iana-timezone-field'

/** DB uses google | calcom | none — normalize legacy UI value. */
function normalizeCalendarType(v: string) {
  if (v === 'gcal') return 'google'
  return v || 'none'
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type SettingsTab = 'tenant' | 'prompts' | 'documents'

// ---------------------------------------------------------------------------
// Tenant Configuration Tab (existing settings)
// ---------------------------------------------------------------------------
function TenantConfigTab({
  tenant,
  credentials,
}: {
  tenant: Tenant
  credentials: Credential[]
}) {
  const getToken = useApiToken()

  const [name, setName] = useState('')
  const [industryType, setIndustryType] = useState('hvac')
  /** Checkboxes for multi-trade (field_service); empty array in API means "all three". */
  const [offeredHvac, setOfferedHvac] = useState(true)
  const [offeredPlumbing, setOfferedPlumbing] = useState(true)
  const [offeredElectrical, setOfferedElectrical] = useState(true)

  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [requiredFields, setRequiredFields] = useState<string[]>([])
  const [optionalFields, setOptionalFields] = useState<string[]>([])
  const [emergencyKeywords, setEmergencyKeywords] = useState<string[]>([])
  const [serviceAreas, setServiceAreas] = useState<string[]>([])
  const [serviceAreaZips, setServiceAreaZips] = useState<string[]>([])
  const [supportedRegions, setSupportedRegions] = useState<string[]>([])
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])

  const [workingHours, setWorkingHours] = useState<Record<string, unknown>>({})
  const [minBookingMinutes, setMinBookingMinutes] = useState('60')
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('90')
  const [escalationStuckTurns, setEscalationStuckTurns] = useState('3')
  const [escalationLowConfidence, setEscalationLowConfidence] = useState('0.65')

  const [calendarType, setCalendarType] = useState('none')
  const [crmType, setCrmType] = useState('none')
  /** IANA zone for booking + DB + Google Calendar (tenants.calendar_settings.timezone). */
  const [businessTimezone, setBusinessTimezone] = useState('America/New_York')

  const [confidenceThreshold, setConfidenceThreshold] = useState('0.75')
  const [maxTurns, setMaxTurns] = useState('12')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const calendarSelectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: 'none', label: 'None' }]
    if (credentials.some((c) => c.integration_type === 'gcal' && c.exists)) {
      opts.push({ value: 'google', label: 'Google Calendar' })
    }
    if (credentials.some((c) => c.integration_type === 'calcom' && c.exists)) {
      opts.push({ value: 'calcom', label: 'Cal.com' })
    }
    return opts
  }, [credentials])

  const crmSelectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: 'none', label: 'None' }]
    if (credentials.some((c) => c.integration_type === 'jobber' && c.exists)) {
      opts.push({ value: 'jobber', label: 'Jobber' })
    }
    if (credentials.some((c) => c.integration_type === 'hubspot' && c.exists)) {
      opts.push({ value: 'hubspot', label: 'HubSpot' })
    }
    return opts
  }, [credentials])

  useEffect(() => {
    setName(tenant.name || '')
    const ind = tenant.industry_type || 'hvac'
    setIndustryType(ind === 'general' ? 'field_service' : ind)
    const ot = tenant.offered_trades || []
    if (ind === 'field_service' || ind === 'general') {
      if (ot.length === 0) {
        setOfferedHvac(true)
        setOfferedPlumbing(true)
        setOfferedElectrical(true)
      } else {
        setOfferedHvac(ot.includes('hvac'))
        setOfferedPlumbing(ot.includes('plumbing'))
        setOfferedElectrical(ot.includes('electrical'))
      }
    } else {
      setOfferedHvac(ind === 'hvac')
      setOfferedPlumbing(ind === 'plumbing')
      setOfferedElectrical(ind === 'electrical')
    }
    setServiceTypes([...(tenant.service_types || [])])
    setRequiredFields([...(tenant.required_fields || [])])
    setOptionalFields([...(tenant.optional_fields || [])])
    setEmergencyKeywords([...(tenant.emergency_keywords || [])])
    setServiceAreas([...(tenant.service_areas || [])])
    setServiceAreaZips([...(tenant.service_area_zips || [])])
    setSupportedRegions([...(tenant.supported_regions || [])])
    setPaymentMethods([...(tenant.payment_methods || [])])
    setWorkingHours({ ...(tenant.working_hours || {}) })
    const bb = tenant.booking_buffers || {}
    setMinBookingMinutes(String((bb as { minimum_minutes?: number }).minimum_minutes ?? 60))
    setSlotDurationMinutes(String((bb as { slot_duration_minutes?: number }).slot_duration_minutes ?? 90))
    const er = tenant.escalation_rules || {}
    setEscalationStuckTurns(String((er as { stuck_turns?: number }).stuck_turns ?? 3))
    setEscalationLowConfidence(String((er as { low_confidence?: number }).low_confidence ?? 0.65))

    const allowedCal = new Set(calendarSelectOptions.map((o) => o.value))
    const wantCal = normalizeCalendarType(tenant.calendar_type || 'none')
    setCalendarType(allowedCal.has(wantCal) ? wantCal : 'none')

    const allowedCrm = new Set(crmSelectOptions.map((o) => o.value))
    const wantCrm = tenant.crm_type || 'none'
    setCrmType(allowedCrm.has(wantCrm) ? wantCrm : 'none')

    setConfidenceThreshold(String(tenant.confidence_threshold ?? 0.75))
    setMaxTurns(String(tenant.max_turns ?? 12))

    const cs = tenant.calendar_settings || {}
    const tzRaw =
      (typeof cs.timezone === 'string' && cs.timezone.trim()) ||
      (typeof (cs as { timeZone?: string }).timeZone === 'string' &&
        (cs as { timeZone: string }).timeZone.trim()) ||
      'America/New_York'
    setBusinessTimezone(tzRaw)
  }, [tenant, calendarSelectOptions, crmSelectOptions])

  const handleSave = async () => {
    if (!name.trim()) { notifyError('Company name is required'); return }
    if (!industryType.trim()) { notifyError('Industry type is required'); return }
    if (industryType === 'field_service') {
      const n = [offeredHvac, offeredPlumbing, offeredElectrical].filter(Boolean).length
      if (n === 0) { notifyError('Select at least one trade (HVAC, plumbing, or electrical)'); return }
    }
    const minM = parseInt(minBookingMinutes, 10)
    const slotM = parseInt(slotDurationMinutes, 10)
    const stuck = parseInt(escalationStuckTurns, 10)
    const lowConf = parseFloat(escalationLowConfidence)
    if (Number.isNaN(minM) || Number.isNaN(slotM)) { notifyError('Booking buffer minutes must be numbers'); return }
    if (Number.isNaN(stuck) || Number.isNaN(lowConf)) { notifyError('Escalation rules must be valid numbers'); return }
    const ct = parseFloat(confidenceThreshold)
    const mt = parseInt(maxTurns, 10)
    if (Number.isNaN(ct) || ct < 0 || ct > 1) { notifyError('Confidence threshold must be between 0 and 1'); return }
    if (Number.isNaN(mt) || mt < 1) { notifyError('Max turns must be at least 1'); return }

    setSaving(true)
    setSaved(false)
    try {
      const token = await getToken()
      // Always persist the exact checkboxes (including all three). Empty array is only for single-trade industries.
      const offered_trades =
        industryType === 'field_service'
          ? (() => {
              const picks: string[] = []
              if (offeredHvac) picks.push('hvac')
              if (offeredPlumbing) picks.push('plumbing')
              if (offeredElectrical) picks.push('electrical')
              return picks
            })()
          : []

      const tz = businessTimezone.trim() || 'America/New_York'
      await api.tenants.update(token, {
        name: name.trim(),
        industry_type: industryType.trim(),
        offered_trades,
        service_types: serviceTypes,
        required_fields: requiredFields,
        optional_fields: optionalFields,
        emergency_keywords: emergencyKeywords,
        service_areas: serviceAreas,
        service_area_zips: serviceAreaZips,
        supported_regions: supportedRegions,
        payment_methods: paymentMethods,
        working_hours: workingHours as Record<string, unknown>,
        booking_buffers: { minimum_minutes: minM, slot_duration_minutes: slotM },
        escalation_rules: { stuck_turns: stuck, low_confidence: lowConf },
        calendar_type: calendarType || 'none',
        crm_type: crmType || 'none',
        confidence_threshold: ct,
        max_turns: mt,
        calendar_settings: {
          ...(tenant.calendar_settings || {}),
          timezone: tz,
          timeZone: tz,
        },
      })
      notifySuccess('Settings saved')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); handleSave() }}
      className="mt-8 max-w-3xl space-y-10"
    >
      <section>
        <Subheading>Organization</Subheading>
        <FieldGroup className="mt-4">
          <Field>
            <Label>Company name</Label>
            <Description>Required — shown to customers where applicable.</Description>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Cool Comfort HVAC" />
          </Field>
          <Field>
            <Label>Primary industry</Label>
            <Description>
              Single-trade companies pick one row. Multi-trade companies choose &quot;Field service (multi-trade)&quot;
              and tick the trades you actually offer below.
            </Description>
            <Select
              required
              value={industryType}
              onChange={(e) => {
                const v = e.target.value
                setIndustryType(v)
                if (v === 'hvac') {
                  setOfferedHvac(true)
                  setOfferedPlumbing(false)
                  setOfferedElectrical(false)
                } else if (v === 'plumbing') {
                  setOfferedHvac(false)
                  setOfferedPlumbing(true)
                  setOfferedElectrical(false)
                } else if (v === 'electrical') {
                  setOfferedHvac(false)
                  setOfferedPlumbing(false)
                  setOfferedElectrical(true)
                } else if (v === 'field_service') {
                  setOfferedHvac(true)
                  setOfferedPlumbing(true)
                  setOfferedElectrical(true)
                }
              }}
            >
              <option value="hvac">HVAC only</option>
              <option value="plumbing">Plumbing only</option>
              <option value="electrical">Electrical only</option>
              <option value="field_service">Field service (multi-trade)</option>
            </Select>
          </Field>
          {industryType === 'field_service' ? (
            <Field>
              <Label>Trades you offer</Label>
              <Description>
                Pick every trade your team dispatches. All three checked is saved as three explicit values in your
                tenant record (not an empty list). Uncheck services you do not provide — the AI only merges playbooks
                for the trades you select.
              </Description>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={offeredHvac} onChange={(e) => setOfferedHvac(e.target.checked)} />
                  HVAC
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={offeredPlumbing}
                    onChange={(e) => setOfferedPlumbing(e.target.checked)}
                  />
                  Plumbing
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={offeredElectrical}
                    onChange={(e) => setOfferedElectrical(e.target.checked)}
                  />
                  Electrical
                </label>
              </div>
            </Field>
          ) : null}
        </FieldGroup>
      </section>

      <Divider />

      <section>
        <Subheading>Services &amp; coverage</Subheading>
        <FieldGroup className="mt-4">
          <Field><TagInput label="Service types" description="Type and press comma or Enter to add each service." value={serviceTypes} onChange={setServiceTypes} placeholder="e.g. AC repair" /></Field>
          <Field><TagInput label="Required booking fields" description="Keys required at booking (e.g. customer_name, phone_number)." value={requiredFields} onChange={setRequiredFields} placeholder="customer_name" /></Field>
          <Field><TagInput label="Optional booking fields" value={optionalFields} onChange={setOptionalFields} placeholder="notes" /></Field>
          <Field><TagInput label="Emergency keywords" value={emergencyKeywords} onChange={setEmergencyKeywords} placeholder="emergency, urgent" /></Field>
          <Field><TagInput label="Service areas (cities/regions)" value={serviceAreas} onChange={setServiceAreas} placeholder="Austin" /></Field>
          <Field><TagInput label="Service area ZIP codes" value={serviceAreaZips} onChange={setServiceAreaZips} placeholder="78701" /></Field>
          <Field><TagInput label="Supported regions" description="e.g. country or region codes." value={supportedRegions} onChange={setSupportedRegions} placeholder="usa" /></Field>
          <Field><TagInput label="Accepted payment methods" description="Shown to customers when they ask 'how can I pay?'. Press comma or Enter to add each method." value={paymentMethods} onChange={setPaymentMethods} placeholder="Cash, Bank transfer, Zelle" /></Field>
        </FieldGroup>
      </section>

      <Divider />

      <section>
        <Subheading>Scheduling</Subheading>
        <FieldGroup className="mt-4">
          <IanaTimezoneField
            value={businessTimezone}
            onChange={setBusinessTimezone}
            id="settings-business-timezone"
            label="Business timezone (IANA)"
            description="Applies to working hours, slot search, how booking times are stored in the database (as UTC with correct local meaning), and Google Calendar events. Choose a city or paste any valid IANA name."
          />
          <Field><WorkingHoursEditor value={workingHours} onChange={setWorkingHours} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><Label>Minimum booking lead time (minutes)</Label><Input type="number" min={0} value={minBookingMinutes} onChange={(e) => setMinBookingMinutes(e.target.value)} /></Field>
            <Field><Label>Default slot duration (minutes)</Label><Input type="number" min={15} value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><Label>Escalation: stuck turns</Label><Input type="number" min={1} value={escalationStuckTurns} onChange={(e) => setEscalationStuckTurns(e.target.value)} /></Field>
            <Field><Label>Escalation: low confidence threshold</Label><Input type="number" step="0.01" min={0} max={1} value={escalationLowConfidence} onChange={(e) => setEscalationLowConfidence(e.target.value)} /></Field>
          </div>
        </FieldGroup>
      </section>

      <Divider />

      <section>
        <Subheading>Integrations</Subheading>
        <Text className="mb-4 text-sm text-zinc-500">
          Choose which systems you use. Store API keys and secrets on the <strong>Integrations</strong> page — not here.
        </Text>
        <FieldGroup>
          <Field>
            <Label>Calendar provider</Label>
            <Description>Only integrations you have added under <strong>Integrations</strong> (with credentials stored) appear here.</Description>
            <Select value={calendarType} onChange={(e) => setCalendarType(e.target.value)}>
              {calendarSelectOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          <Field>
            <Label>CRM provider</Label>
            <Description>Same as calendar — only providers with stored credentials are listed.</Description>
            <Select value={crmType} onChange={(e) => setCrmType(e.target.value)}>
              {crmSelectOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
        </FieldGroup>
      </section>

      <Divider />

      <section>
        <Subheading>Assistant</Subheading>
        <FieldGroup className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <Label>Confidence threshold</Label>
              <Description>0.0 – 1.0</Description>
              <Input type="number" step="0.05" min={0} max={1} value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(e.target.value)} />
            </Field>
            <Field>
              <Label>Max conversation turns</Label>
              <Input type="number" min={1} max={100} value={maxTurns} onChange={(e) => setMaxTurns(e.target.value)} />
            </Field>
          </div>
        </FieldGroup>
      </section>

      <div className="flex items-center gap-4 pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
        {saved && <Text className="text-sm text-green-600 dark:text-green-400">Settings saved successfully</Text>}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Prompt Configuration Tab
// ---------------------------------------------------------------------------
function PromptConfigTab() {
  const getToken = useApiToken()
  const { data: prompts, loading, refetch } = useApiData<PromptConfig[]>(
    (token) => api.prompts.list(token),
  )

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resettingKey, setResettingKey] = useState<string | null>(null)
  const [resettingAll, setResettingAll] = useState(false)

  useEffect(() => {
    if (prompts) {
      const initial: Record<string, string> = {}
      for (const p of prompts) initial[p.node_key] = p.prompt_text
      setDrafts(initial)
    }
  }, [prompts])

  const handleSave = async (nodeKey: string) => {
    const text = drafts[nodeKey]
    if (text === undefined) return
    setSavingKey(nodeKey)
    try {
      const token = await getToken()
      await api.prompts.update(token, nodeKey, text)
      notifySuccess(`Prompt "${nodeKey}" saved`)
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not save prompt')
    } finally {
      setSavingKey(null)
    }
  }

  const handleReset = async (nodeKey: string) => {
    setResettingKey(nodeKey)
    try {
      const token = await getToken()
      const result = await api.prompts.reset(token, nodeKey)
      setDrafts((prev) => ({ ...prev, [nodeKey]: result.prompt_text }))
      notifySuccess(`Prompt "${nodeKey}" reset to default`)
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not reset prompt')
    } finally {
      setResettingKey(null)
    }
  }

  const handleResetAll = async () => {
    setResettingAll(true)
    try {
      const token = await getToken()
      await api.prompts.resetAll(token)
      notifySuccess('All prompts reset to defaults')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not reset prompts')
    } finally {
      setResettingAll(false)
    }
  }

  if (loading || !prompts) {
    return (
      <div className="mt-8 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    )
  }

  const hasAnyCustom = prompts.some((p) => p.is_custom)

  return (
    <div className="mt-8 max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Text className="text-sm text-zinc-500">
            Customize the system prompts used by each AI node. Use placeholders like{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{INDUSTRY}}'}</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{SERVICE_LIST}}'}</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{SERVICE_AREAS}}'}</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{BUSINESS_HOURS}}'}</code>{' '}
            — they are replaced automatically with your tenant config values.
          </Text>
        </div>
        {hasAnyCustom && (
          <Button
            type="button"
            color="zinc"
            onClick={handleResetAll}
            disabled={resettingAll}
          >
            {resettingAll ? 'Resetting...' : 'Reset all to defaults'}
          </Button>
        )}
      </div>

      {prompts.map((prompt) => {
        const draft = drafts[prompt.node_key] ?? prompt.prompt_text
        const isModified = draft !== prompt.prompt_text
        const isSaving = savingKey === prompt.node_key
        const isResetting = resettingKey === prompt.node_key

        return (
          <div
            key={prompt.node_key}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {prompt.label}
                  </h3>
                  {prompt.is_custom ? (
                    <Badge color="blue">Custom</Badge>
                  ) : (
                    <Badge color="zinc">Default</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {prompt.description}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Node key: <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">{prompt.node_key}</code>
                </p>
              </div>
            </div>

            <Textarea
              value={draft}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDrafts((prev) => ({ ...prev, [prompt.node_key]: e.target.value }))
              }
              rows={10}
              className="font-mono text-xs"
              resizable
            />

            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                onClick={() => handleSave(prompt.node_key)}
                disabled={isSaving || (!isModified && !prompt.is_custom && draft === prompt.prompt_text)}
              >
                {isSaving ? 'Saving...' : 'Save prompt'}
              </Button>
              {prompt.is_custom && (
                <Button
                  type="button"
                  color="zinc"
                  onClick={() => handleReset(prompt.node_key)}
                  disabled={isResetting}
                >
                  {isResetting ? 'Resetting...' : 'Revert to default'}
                </Button>
              )}
              {isModified && (
                <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { data: tenant, loading, refetch } = useApiData<Tenant>(
    (token) => api.tenants.me(token),
  )

  const { data: credentials, loading: credsLoading } = useApiData<Credential[]>(
    (token) => api.credentials.list(token),
  )

  const [activeTab, setActiveTab] = useState<SettingsTab>('tenant')

  if (loading || credsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-96 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
    )
  }

  return (
    <>
      <Heading>Settings</Heading>
      <Text className="mt-2 text-sm text-zinc-500">
        Manage your organization profile, knowledge base documents, AI prompts, and assistant behavior.
      </Text>

      {/* Tab navigation */}
      <div className="mt-6 border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-6" aria-label="Settings tabs">
          <button
            type="button"
            onClick={() => setActiveTab('tenant')}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'tenant'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Tenant Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'documents'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Knowledge documents
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'prompts'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Prompt Configuration
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'tenant' && tenant && credentials && (
        <TenantConfigTab tenant={tenant} credentials={credentials} />
      )}
      {activeTab === 'documents' && <DocumentsTab />}
      {activeTab === 'prompts' && <PromptConfigTab />}
    </>
  )
}

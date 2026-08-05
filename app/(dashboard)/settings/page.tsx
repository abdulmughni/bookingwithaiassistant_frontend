'use client'

import { useEffect, useMemo, useState } from 'react'
import { Subheading } from '@/components/heading'
import { PageHeader, PageShell, settingsTabClass } from '@/components/dashboard-ui'
import { Button } from '@/components/button'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
import { TagInput } from '@/components/tag-input'
import { WorkingHoursEditor } from '@/components/working-hours-editor'
import { useApiData, useApiToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Credential, Tenant, TimezoneChoice } from '@/lib/types'
import { DocumentsTab } from './documents-tab'
import { ReadOnlyBanner, useReadOnlyAccount } from '@/components/account-status-gate'
import { CostPolicyPicker } from '@/components/cost-policy-picker'

/**
 * Disables every form control inside (native fieldset semantics) and blocks
 * pointer interaction when the account is not active. Backend write endpoints
 * also 403, so this is purely a UX courtesy.
 */
function LockWhenReadOnly({
  readOnly,
  children,
}: {
  readOnly: boolean
  children: React.ReactNode
}) {
  if (!readOnly) return <>{children}</>
  return (
    <fieldset disabled className="pointer-events-none min-w-0 select-none opacity-60">
      {children}
    </fieldset>
  )
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type SettingsTab = 'tenant' | 'documents'

type TenantFormSnapshot = {
  name: string
  industry_type: string
  offered_trades: string[]
  service_types: string[]
  required_fields: string[]
  optional_fields: string[]
  service_areas: string[]
  service_area_zips: string[]
  payment_methods: string[]
  waive_diagnostic_fee: boolean
  serves_commercial: boolean
  timezone: string
  working_hours: Record<string, unknown>
  booking_buffers: {
    minimum_minutes: number
    slot_duration_minutes: number
    max_simultaneous_bookings: number
  }
  escalation_rules: { stuck_turns: number; low_confidence: number }
  crm_type: string
  confidence_threshold: number
  max_turns: number
}

function resolveIndustryType(raw: string): string {
  return raw === 'general' ? 'field_service' : raw || 'hvac'
}

function resolveOfferedTrades(tenant: Tenant): { hvac: boolean; plumbing: boolean; electrical: boolean } {
  const ind = resolveIndustryType(tenant.industry_type || 'hvac')
  const ot = tenant.offered_trades || []
  if (ind === 'field_service' || ind === 'general') {
    if (ot.length === 0) {
      return { hvac: true, plumbing: true, electrical: true }
    }
    return {
      hvac: ot.includes('hvac'),
      plumbing: ot.includes('plumbing'),
      electrical: ot.includes('electrical'),
    }
  }
  return {
    hvac: ind === 'hvac',
    plumbing: ind === 'plumbing',
    electrical: ind === 'electrical',
  }
}

function snapshotFromTenant(
  tenant: Tenant,
  allowedCrmValues: Set<string>,
): TenantFormSnapshot {
  const industryType = resolveIndustryType(tenant.industry_type || 'hvac')
  const trades = resolveOfferedTrades(tenant)
  const bb = tenant.booking_buffers || {}
  const er = tenant.escalation_rules || {}
  const wantCrm = tenant.crm_type || 'none'

  return {
    name: tenant.name || '',
    industry_type: industryType,
    offered_trades:
      industryType === 'field_service'
        ? (() => {
            const picks: string[] = []
            if (trades.hvac) picks.push('hvac')
            if (trades.plumbing) picks.push('plumbing')
            if (trades.electrical) picks.push('electrical')
            return picks
          })()
        : [],
    service_types: [...(tenant.service_types || [])],
    required_fields: [...(tenant.required_fields || [])],
    optional_fields: [...(tenant.optional_fields || [])],
    service_areas: [...(tenant.service_areas || [])],
    service_area_zips: [...(tenant.service_area_zips || [])],
    payment_methods: [...(tenant.payment_methods || [])],
    waive_diagnostic_fee: tenant.waive_diagnostic_fee !== false,
    serves_commercial: Boolean(tenant.serves_commercial),
    timezone: tenant.timezone || 'UTC',
    working_hours: { ...(tenant.working_hours || {}) },
    booking_buffers: {
      minimum_minutes: Number((bb as { minimum_minutes?: number }).minimum_minutes ?? 60),
      slot_duration_minutes: Number((bb as { slot_duration_minutes?: number }).slot_duration_minutes ?? 90),
      max_simultaneous_bookings: Number(
        (bb as { max_simultaneous_bookings?: number }).max_simultaneous_bookings ?? 1,
      ),
    },
    escalation_rules: {
      stuck_turns: Number((er as { stuck_turns?: number }).stuck_turns ?? 3),
      low_confidence: Number((er as { low_confidence?: number }).low_confidence ?? 0.65),
    },
    crm_type: allowedCrmValues.has(wantCrm) ? wantCrm : 'none',
    confidence_threshold: Number(tenant.confidence_threshold ?? 0.75),
    max_turns: Number(tenant.max_turns ?? 12),
  }
}

// ---------------------------------------------------------------------------
// Tenant Configuration Tab (existing settings)
// ---------------------------------------------------------------------------
function TenantConfigTab({
  tenant,
  credentials,
  onSaved,
}: {
  tenant: Tenant
  credentials: Credential[]
  onSaved: () => void
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
  const [serviceAreas, setServiceAreas] = useState<string[]>([])
  const [serviceAreaZips, setServiceAreaZips] = useState<string[]>([])
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [waiveDiagnosticFee, setWaiveDiagnosticFee] = useState(true)
  const [servesCommercial, setServesCommercial] = useState(false)

  const [timezone, setTimezone] = useState<string>('UTC')
  const [timezoneChoices, setTimezoneChoices] = useState<TimezoneChoice[]>([])

  const [workingHours, setWorkingHours] = useState<Record<string, unknown>>({})
  const [minBookingMinutes, setMinBookingMinutes] = useState('60')
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('90')
  const [maxSimultaneousBookings, setMaxSimultaneousBookings] = useState('1')
  const [escalationStuckTurns, setEscalationStuckTurns] = useState('3')
  const [escalationLowConfidence, setEscalationLowConfidence] = useState('0.65')

  const [crmType, setCrmType] = useState('none')

  const [confidenceThreshold, setConfidenceThreshold] = useState('0.75')
  const [maxTurns, setMaxTurns] = useState('12')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  const allowedCrmValues = useMemo(
    () => new Set(crmSelectOptions.map((o) => o.value)),
    [crmSelectOptions],
  )

  const baseline = useMemo(
    () => snapshotFromTenant(tenant, allowedCrmValues),
    [tenant, allowedCrmValues],
  )

  const currentSnapshot = useMemo((): TenantFormSnapshot => {
    const minM = parseInt(minBookingMinutes, 10)
    const slotM = parseInt(slotDurationMinutes, 10)
    const maxSim = parseInt(maxSimultaneousBookings, 10)
    const stuck = parseInt(escalationStuckTurns, 10)
    const lowConf = parseFloat(escalationLowConfidence)
    const ct = parseFloat(confidenceThreshold)
    const mt = parseInt(maxTurns, 10)

    return {
      name: name.trim(),
      industry_type: industryType.trim(),
      offered_trades:
        industryType === 'field_service'
          ? (() => {
              const picks: string[] = []
              if (offeredHvac) picks.push('hvac')
              if (offeredPlumbing) picks.push('plumbing')
              if (offeredElectrical) picks.push('electrical')
              return picks
            })()
          : [],
      service_types: serviceTypes,
      required_fields: requiredFields,
      optional_fields: optionalFields,
      service_areas: serviceAreas,
      service_area_zips: serviceAreaZips,
      payment_methods: paymentMethods,
      waive_diagnostic_fee: waiveDiagnosticFee,
      serves_commercial: servesCommercial,
      timezone: timezone.trim() || 'UTC',
      working_hours: workingHours,
      booking_buffers: {
        minimum_minutes: Number.isNaN(minM) ? baseline.booking_buffers.minimum_minutes : minM,
        slot_duration_minutes: Number.isNaN(slotM) ? baseline.booking_buffers.slot_duration_minutes : slotM,
        max_simultaneous_bookings: Number.isNaN(maxSim)
          ? baseline.booking_buffers.max_simultaneous_bookings
          : maxSim,
      },
      escalation_rules: {
        stuck_turns: Number.isNaN(stuck) ? baseline.escalation_rules.stuck_turns : stuck,
        low_confidence: Number.isNaN(lowConf) ? baseline.escalation_rules.low_confidence : lowConf,
      },
      crm_type: crmType || 'none',
      confidence_threshold: Number.isNaN(ct) ? baseline.confidence_threshold : ct,
      max_turns: Number.isNaN(mt) ? baseline.max_turns : mt,
    }
  }, [
    name,
    industryType,
    offeredHvac,
    offeredPlumbing,
    offeredElectrical,
    serviceTypes,
    requiredFields,
    optionalFields,
    serviceAreas,
    serviceAreaZips,
    paymentMethods,
    waiveDiagnosticFee,
    servesCommercial,
    timezone,
    workingHours,
    minBookingMinutes,
    slotDurationMinutes,
    maxSimultaneousBookings,
    escalationStuckTurns,
    escalationLowConfidence,
    crmType,
    confidenceThreshold,
    maxTurns,
    baseline,
  ])

  const isDirty = useMemo(
    () => JSON.stringify(currentSnapshot) !== JSON.stringify(baseline),
    [currentSnapshot, baseline],
  )

  useEffect(() => {
    const snap = snapshotFromTenant(tenant, allowedCrmValues)
    setName(snap.name)
    setIndustryType(snap.industry_type)
    const trades = resolveOfferedTrades(tenant)
    setOfferedHvac(trades.hvac)
    setOfferedPlumbing(trades.plumbing)
    setOfferedElectrical(trades.electrical)
    setServiceTypes([...snap.service_types])
    setRequiredFields([...snap.required_fields])
    setOptionalFields([...snap.optional_fields])
    setServiceAreas([...snap.service_areas])
    setServiceAreaZips([...snap.service_area_zips])
    setPaymentMethods([...snap.payment_methods])
    setWaiveDiagnosticFee(snap.waive_diagnostic_fee)
    setServesCommercial(snap.serves_commercial)
    setTimezone(snap.timezone)
    setWorkingHours({ ...snap.working_hours })
    setMinBookingMinutes(String(snap.booking_buffers.minimum_minutes))
    setSlotDurationMinutes(String(snap.booking_buffers.slot_duration_minutes))
    setMaxSimultaneousBookings(String(snap.booking_buffers.max_simultaneous_bookings))
    setEscalationStuckTurns(String(snap.escalation_rules.stuck_turns))
    setEscalationLowConfidence(String(snap.escalation_rules.low_confidence))
    setCrmType(snap.crm_type)
    setConfidenceThreshold(String(snap.confidence_threshold))
    setMaxTurns(String(snap.max_turns))
  }, [tenant, allowedCrmValues])

  // Load the curated IANA list once. The dropdown is the only way to set the
  // tenant timezone — values saved on the tenant are pure IANA strings.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const choices = await api.tenants.timezones(token)
        if (!cancelled) setTimezoneChoices(choices)
      } catch (e) {
        if (!cancelled) {
          notifyError(
            e instanceof ApiError ? e.message : 'Could not load timezone list',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  const handleSave = async () => {
    if (!name.trim()) { notifyError('Company name is required'); return }
    if (!industryType.trim()) { notifyError('Industry type is required'); return }
    if (industryType === 'field_service') {
      const n = [offeredHvac, offeredPlumbing, offeredElectrical].filter(Boolean).length
      if (n === 0) { notifyError('Select at least one trade (HVAC, plumbing, or electrical)'); return }
    }
    const minM = parseInt(minBookingMinutes, 10)
    const slotM = parseInt(slotDurationMinutes, 10)
    const maxSim = parseInt(maxSimultaneousBookings, 10)
    const stuck = parseInt(escalationStuckTurns, 10)
    const lowConf = parseFloat(escalationLowConfidence)
    if (Number.isNaN(minM) || Number.isNaN(slotM) || Number.isNaN(maxSim)) {
      notifyError('Booking buffer settings must be valid numbers')
      return
    }
    if (maxSim < 1) { notifyError('Max simultaneous bookings must be at least 1'); return }
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

      await api.tenants.update(token, {
        name: name.trim(),
        industry_type: industryType.trim(),
        offered_trades,
        service_types: serviceTypes,
        required_fields: requiredFields,
        optional_fields: optionalFields,
        service_areas: serviceAreas,
        service_area_zips: serviceAreaZips,
        payment_methods: paymentMethods,
        waive_diagnostic_fee: waiveDiagnosticFee,
        serves_commercial: servesCommercial,
        timezone: timezone.trim() || 'UTC',
        working_hours: workingHours as Record<string, unknown>,
        booking_buffers: {
          minimum_minutes: minM,
          slot_duration_minutes: slotM,
          max_simultaneous_bookings: maxSim,
        },
        escalation_rules: { stuck_turns: stuck, low_confidence: lowConf },
        crm_type: crmType || 'none',
        confidence_threshold: ct,
        max_turns: mt,
      })
      notifySuccess('Settings saved')
      setSaved(true)
      onSaved()
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
        <Subheading>Cost policy</Subheading>
        <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Controls how the booking assistant explains fees before confirmation. Pick one fee rule;
          optionally add commercial work.
        </Text>
        <div className="mt-4">
          <CostPolicyPicker
            value={{
              waive_diagnostic_fee: waiveDiagnosticFee,
              serves_commercial: servesCommercial,
            }}
            onChange={(next) => {
              setWaiveDiagnosticFee(next.waive_diagnostic_fee)
              setServesCommercial(next.serves_commercial)
            }}
          />
        </div>
      </section>

      <Divider />

      <section>
        <Subheading>Services &amp; coverage</Subheading>
        <FieldGroup className="mt-4">
          <Field><TagInput label="Service types" description="Type and press comma or Enter to add each service." value={serviceTypes} onChange={setServiceTypes} placeholder="e.g. AC repair" /></Field>
          <Field><TagInput label="Required booking fields" description="Keys required at booking (e.g. customer_name, phone_number)." value={requiredFields} onChange={setRequiredFields} placeholder="customer_name" /></Field>
          <Field><TagInput label="Optional booking fields" value={optionalFields} onChange={setOptionalFields} placeholder="notes" /></Field>
          <Field><TagInput label="Service areas (cities/regions)" description="Towns and neighborhoods you cover. Also add common short forms as separate entries (e.g. BK, NYC)." value={serviceAreas} onChange={setServiceAreas} placeholder="Austin" /></Field>
          <Field><TagInput label="Service area ZIP codes" value={serviceAreaZips} onChange={setServiceAreaZips} placeholder="78701" /></Field>
          <Field><TagInput label="Accepted payment methods" description="Shown to customers when they ask 'how can I pay?'. Press comma or Enter to add each method." value={paymentMethods} onChange={setPaymentMethods} placeholder="Cash, Bank transfer, Zelle" /></Field>
        </FieldGroup>
      </section>

      <Divider />

      <section>
        <Subheading>Scheduling</Subheading>
        <FieldGroup className="mt-4">
          <Field>
            <Label>Timezone</Label>
            <Description>
              All booking times are stored in UTC and shown to you in this timezone. Pick the one your
              dispatch team works in. Saved as an IANA name (e.g. <code>America/New_York</code>).
            </Description>
            <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {timezoneChoices.length === 0 && (
                <option value={timezone || 'UTC'}>{timezone || 'UTC'}</option>
              )}
              {timezoneChoices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
              {/* Surface the stored value when it's outside the curated list (legacy rows). */}
              {timezone &&
                !timezoneChoices.some((c) => c.value === timezone) && (
                  <option value={timezone}>{timezone}</option>
                )}
            </Select>
            <Text className="mt-1 text-xs text-zinc-500">
              Will be saved as <code>{timezone || 'UTC'}</code>.
            </Text>
          </Field>
          <Field><WorkingHoursEditor value={workingHours} onChange={setWorkingHours} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><Label>Minimum booking lead time (minutes)</Label><Input type="number" min={0} value={minBookingMinutes} onChange={(e) => setMinBookingMinutes(e.target.value)} /></Field>
            <Field><Label>Default slot duration (minutes)</Label><Input type="number" min={15} value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(e.target.value)} /></Field>
          </div>
          <Field>
            <Label>Max simultaneous bookings</Label>
            <Description>
              How many appointments can overlap at the same time (e.g. 3 if you have three technicians).
              A time stays bookable until this limit is reached.
            </Description>
            <Input
              type="number"
              min={1}
              value={maxSimultaneousBookings}
              onChange={(e) => setMaxSimultaneousBookings(e.target.value)}
            />
          </Field>
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
          Choose your CRM for booking sync. Store OAuth keys on the <strong>Integrations</strong> page — not here.
        </Text>
        <FieldGroup>
          <Field>
            <Label>CRM provider</Label>
            <Description>Only providers with stored credentials appear here.</Description>
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
        <Button type="submit" disabled={saving || !isDirty}>
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
        {isDirty && !saving && (
          <Text className="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</Text>
        )}
        {saved && !isDirty && (
          <Text className="text-sm text-brand-600 dark:text-brand-400">Settings saved successfully</Text>
        )}
      </div>
    </form>
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

  const { readOnly } = useReadOnlyAccount()
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
    <PageShell>
      <PageHeader
        title="Settings"
        description="Manage your organization profile, knowledge base documents, and assistant behavior."
      />

      <ReadOnlyBanner />

      <div className="rounded-2xl border border-zinc-200/80 bg-white px-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80 sm:px-6">
        <nav className="-mb-px flex gap-6 border-b border-zinc-200/80 pt-2 dark:border-zinc-700/80" aria-label="Settings tabs">
          <button
            type="button"
            onClick={() => setActiveTab('tenant')}
            className={settingsTabClass(activeTab === 'tenant')}
          >
            Tenant Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={settingsTabClass(activeTab === 'documents')}
          >
            Knowledge documents
          </button>
        </nav>
      </div>

      {/* Tab content — locked (read-only) until the account is active */}
      <LockWhenReadOnly readOnly={readOnly}>
        {activeTab === 'tenant' && tenant && credentials && (
          <TenantConfigTab tenant={tenant} credentials={credentials} onSaved={refetch} />
        )}
        {activeTab === 'documents' && <DocumentsTab />}
      </LockWhenReadOnly>
    </PageShell>
  )
}

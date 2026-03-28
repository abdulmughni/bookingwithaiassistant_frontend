'use client'

import { useEffect, useState } from 'react'
import { Heading, Subheading } from '@/components/heading'
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
import type { Tenant } from '@/lib/types'

/** DB uses google | calcom | none — normalize legacy UI value. */
function normalizeCalendarType(v: string) {
  if (v === 'gcal') return 'google'
  return v || 'none'
}

export default function SettingsPage() {
  const getToken = useApiToken()
  const { data: tenant, loading, refetch } = useApiData<Tenant>(
    (token) => api.tenants.me(token),
  )

  const [name, setName] = useState('')
  const [industryType, setIndustryType] = useState('hvac')

  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [requiredFields, setRequiredFields] = useState<string[]>([])
  const [optionalFields, setOptionalFields] = useState<string[]>([])
  const [emergencyKeywords, setEmergencyKeywords] = useState<string[]>([])
  const [serviceAreas, setServiceAreas] = useState<string[]>([])
  const [serviceAreaZips, setServiceAreaZips] = useState<string[]>([])
  const [supportedRegions, setSupportedRegions] = useState<string[]>([])

  const [workingHours, setWorkingHours] = useState<Record<string, unknown>>({})
  const [minBookingMinutes, setMinBookingMinutes] = useState('60')
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('90')
  const [escalationStuckTurns, setEscalationStuckTurns] = useState('3')
  const [escalationLowConfidence, setEscalationLowConfidence] = useState('0.65')

  const [calendarType, setCalendarType] = useState('none')
  const [crmType, setCrmType] = useState('none')

  const [confidenceThreshold, setConfidenceThreshold] = useState('0.75')
  const [maxTurns, setMaxTurns] = useState('12')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!tenant) return
    setName(tenant.name || '')
    setIndustryType(tenant.industry_type || 'hvac')

    setServiceTypes([...(tenant.service_types || [])])
    setRequiredFields([...(tenant.required_fields || [])])
    setOptionalFields([...(tenant.optional_fields || [])])
    setEmergencyKeywords([...(tenant.emergency_keywords || [])])
    setServiceAreas([...(tenant.service_areas || [])])
    setServiceAreaZips([...(tenant.service_area_zips || [])])
    setSupportedRegions([...(tenant.supported_regions || [])])

    setWorkingHours({ ...(tenant.working_hours || {}) })
    const bb = tenant.booking_buffers || {}
    setMinBookingMinutes(String((bb as { minimum_minutes?: number }).minimum_minutes ?? 60))
    setSlotDurationMinutes(String((bb as { slot_duration_minutes?: number }).slot_duration_minutes ?? 90))
    const er = tenant.escalation_rules || {}
    setEscalationStuckTurns(String((er as { stuck_turns?: number }).stuck_turns ?? 3))
    setEscalationLowConfidence(String((er as { low_confidence?: number }).low_confidence ?? 0.65))

    setCalendarType(normalizeCalendarType(tenant.calendar_type || 'none'))
    setCrmType(tenant.crm_type || 'none')

    setConfidenceThreshold(String(tenant.confidence_threshold ?? 0.75))
    setMaxTurns(String(tenant.max_turns ?? 12))
  }, [tenant])

  const handleSave = async () => {
    if (!name.trim()) {
      notifyError('Company name is required')
      return
    }
    if (!industryType.trim()) {
      notifyError('Industry type is required')
      return
    }

    const minM = parseInt(minBookingMinutes, 10)
    const slotM = parseInt(slotDurationMinutes, 10)
    const stuck = parseInt(escalationStuckTurns, 10)
    const lowConf = parseFloat(escalationLowConfidence)
    if (Number.isNaN(minM) || Number.isNaN(slotM)) {
      notifyError('Booking buffer minutes must be numbers')
      return
    }
    if (Number.isNaN(stuck) || Number.isNaN(lowConf)) {
      notifyError('Escalation rules must be valid numbers')
      return
    }

    const ct = parseFloat(confidenceThreshold)
    const mt = parseInt(maxTurns, 10)
    if (Number.isNaN(ct) || ct < 0 || ct > 1) {
      notifyError('Confidence threshold must be between 0 and 1')
      return
    }
    if (Number.isNaN(mt) || mt < 1) {
      notifyError('Max turns must be at least 1')
      return
    }

    setSaving(true)
    setSaved(false)
    try {
      const token = await getToken()
      await api.tenants.update(token, {
        name: name.trim(),
        industry_type: industryType.trim(),
        service_types: serviceTypes,
        required_fields: requiredFields,
        optional_fields: optionalFields,
        emergency_keywords: emergencyKeywords,
        service_areas: serviceAreas,
        service_area_zips: serviceAreaZips,
        supported_regions: supportedRegions,
        working_hours: workingHours as Record<string, unknown>,
        booking_buffers: {
          minimum_minutes: minM,
          slot_duration_minutes: slotM,
        },
        escalation_rules: {
          stuck_turns: stuck,
          low_confidence: lowConf,
        },
        calendar_type: calendarType || 'none',
        crm_type: crmType || 'none',
        confidence_threshold: ct,
        max_turns: mt,
      })
      notifySuccess('Settings saved')
      setSaved(true)
      refetch()
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
        Update your organization profile, coverage, scheduling, and assistant behavior. Manage API credentials under{' '}
        <strong>Integrations</strong>.
      </Text>
      <Divider className="mt-6" />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
        className="mt-8 max-w-3xl space-y-10"
      >
        <section>
          <Subheading>Organization</Subheading>
          <FieldGroup className="mt-4">
            <Field>
              <Label>Company name</Label>
              <Description>Required — shown to customers where applicable.</Description>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cool Comfort HVAC"
              />
            </Field>
            <Field>
              <Label>Industry type</Label>
              <Description>Required — drives defaults in the AI engine (e.g. hvac, plumbing).</Description>
              <Select required value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
                <option value="hvac">HVAC</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="general">General / other</option>
              </Select>
            </Field>
          </FieldGroup>
        </section>

        <Divider />

        <section>
          <Subheading>Services &amp; coverage</Subheading>
          <FieldGroup className="mt-4">
            <Field>
              <TagInput
                label="Service types"
                description="Type and press comma or Enter to add each service."
                value={serviceTypes}
                onChange={setServiceTypes}
                placeholder="e.g. AC repair"
              />
            </Field>
            <Field>
              <TagInput
                label="Required booking fields"
                description="Keys required at booking (e.g. customer_name, phone_number)."
                value={requiredFields}
                onChange={setRequiredFields}
                placeholder="customer_name"
              />
            </Field>
            <Field>
              <TagInput
                label="Optional booking fields"
                value={optionalFields}
                onChange={setOptionalFields}
                placeholder="notes"
              />
            </Field>
            <Field>
              <TagInput
                label="Emergency keywords"
                value={emergencyKeywords}
                onChange={setEmergencyKeywords}
                placeholder="emergency, urgent"
              />
            </Field>
            <Field>
              <TagInput
                label="Service areas (cities/regions)"
                value={serviceAreas}
                onChange={setServiceAreas}
                placeholder="Austin"
              />
            </Field>
            <Field>
              <TagInput
                label="Service area ZIP codes"
                value={serviceAreaZips}
                onChange={setServiceAreaZips}
                placeholder="78701"
              />
            </Field>
            <Field>
              <TagInput
                label="Supported regions"
                description="e.g. country or region codes."
                value={supportedRegions}
                onChange={setSupportedRegions}
                placeholder="usa"
              />
            </Field>
          </FieldGroup>
        </section>

        <Divider />

        <section>
          <Subheading>Scheduling</Subheading>
          <FieldGroup className="mt-4">
            <Field>
              <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <Label>Minimum booking lead time (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={minBookingMinutes}
                  onChange={(e) => setMinBookingMinutes(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Default slot duration (minutes)</Label>
                <Input
                  type="number"
                  min={15}
                  value={slotDurationMinutes}
                  onChange={(e) => setSlotDurationMinutes(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <Label>Escalation: stuck turns</Label>
                <Input
                  type="number"
                  min={1}
                  value={escalationStuckTurns}
                  onChange={(e) => setEscalationStuckTurns(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Escalation: low confidence threshold</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={escalationLowConfidence}
                  onChange={(e) => setEscalationLowConfidence(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
        </section>

        <Divider />

        <section>
          <Subheading>Integrations</Subheading>
          <Text className="mb-4 text-sm text-zinc-500">
            Choose which systems you use. Store API keys and secrets on the <strong>Integrations</strong> page — not
            here.
          </Text>
          <FieldGroup>
            <Field>
              <Label>Calendar provider</Label>
              <Description>Must match database: none, google, or calcom.</Description>
              <Select value={calendarType} onChange={(e) => setCalendarType(e.target.value)}>
                <option value="none">None</option>
                <option value="google">Google Calendar</option>
                <option value="calcom">Cal.com</option>
              </Select>
            </Field>
            <Field>
              <Label>CRM provider</Label>
              <Select value={crmType} onChange={(e) => setCrmType(e.target.value)}>
                <option value="none">None</option>
                <option value="jobber">Jobber</option>
                <option value="hubspot">HubSpot</option>
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
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Max conversation turns</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
        </section>

        <div className="flex items-center gap-4 pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </Button>
          {saved && (
            <Text className="text-sm text-green-600 dark:text-green-400">Settings saved successfully</Text>
          )}
        </div>
      </form>
    </>
  )
}

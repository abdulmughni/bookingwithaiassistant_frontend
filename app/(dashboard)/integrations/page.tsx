'use client'

import { useState } from 'react'
import { Heading, Subheading } from '@/components/heading'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Divider } from '@/components/divider'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Select } from '@/components/select'
import { Textarea } from '@/components/textarea'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/dialog'
import { Field, FieldGroup, Label, Description } from '@/components/fieldset'
import { useApiData, useApiToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import type { Credential } from '@/lib/types'

function integrationLabel(type: string): string {
  switch (type) {
    case 'gcal':
      return 'Google Calendar'
    case 'calcom':
      return 'Cal.com'
    case 'jobber':
      return 'Jobber CRM'
    case 'hubspot':
      return 'HubSpot CRM'
    default:
      return type
  }
}

function integrationColor(
  type: string,
): 'sky' | 'lime' | 'amber' | 'zinc' {
  switch (type) {
    case 'gcal':
      return 'sky'
    case 'calcom':
      return 'zinc'
    case 'jobber':
      return 'lime'
    case 'hubspot':
      return 'amber'
    default:
      return 'zinc'
  }
}

export default function IntegrationsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [newRef, setNewRef] = useState('')
  const [newType, setNewType] = useState('gcal')
  const [newCreds, setNewCreds] = useState('')
  const [saving, setSaving] = useState(false)
  const getToken = useApiToken()

  const { data: credentials, loading, refetch } = useApiData<Credential[]>(
    (token) => api.credentials.list(token),
  )

  const handleStore = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      const parsed = JSON.parse(newCreds)
      await api.credentials.store(token, {
        ref: newRef,
        integration_type: newType,
        credentials: parsed,
      })
      setShowAdd(false)
      setNewRef('')
      setNewCreds('')
      notifySuccess('Credentials stored')
      refetch()
    } catch (err) {
      if (err instanceof SyntaxError) {
        notifyError('Invalid JSON in credentials field')
      } else {
        notifyError(err instanceof ApiError ? err.message : String(err))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ref: string) => {
    try {
      const token = await getToken()
      await api.credentials.remove(token, ref)
      notifySuccess('Integration removed')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not remove integration')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Integrations</Heading>
          <Text className="mt-1">
            Manage calendar and CRM integration credentials.
          </Text>
        </div>
        <Button onClick={() => setShowAdd(true)}>Add integration</Button>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6">
        {loading ? (
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ) : credentials && credentials.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {credentials.map((cred) => (
              <div
                key={cred.ref}
                className="rounded-lg border border-zinc-950/5 p-5 dark:border-white/5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Badge color={integrationColor(cred.integration_type)}>
                      {integrationLabel(cred.integration_type)}
                    </Badge>
                    <p className="mt-2 font-mono text-sm text-zinc-950 dark:text-white">
                      {cred.ref}
                    </p>
                  </div>
                  <Badge color={cred.has_credentials ? 'lime' : 'red'}>
                    {cred.has_credentials ? 'Active' : 'Missing'}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Added {formatDate(cred.created_at)}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    plain
                    className="text-xs text-red-600"
                    onClick={() => handleDelete(cred.ref)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text className="py-8 text-center">
            No integrations configured yet
          </Text>
        )}
      </div>

      {/* Add Integration Dialog */}
      <Dialog open={showAdd} onClose={setShowAdd}>
        <DialogTitle>Add Integration</DialogTitle>
        <DialogDescription>
          Store encrypted credentials for a calendar or CRM provider.
        </DialogDescription>
        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>Reference Key</Label>
              <Input
                placeholder="e.g. gcal_main, hubspot_prod"
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
              />
            </Field>
            <Field>
              <Label>Integration Type</Label>
              <Select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="gcal">Google Calendar</option>
                <option value="calcom">Cal.com</option>
                <option value="jobber">Jobber CRM</option>
                <option value="hubspot">HubSpot CRM</option>
              </Select>
            </Field>
            <Field>
              <Label>Credentials (JSON)</Label>
              <Description>
                Paste the full JSON credentials object. It will be encrypted at
                rest.
              </Description>
              <Textarea
                rows={8}
                placeholder='{"api_key": "...", "secret": "..."}'
                value={newCreds}
                onChange={(e) => setNewCreds(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStore}
            disabled={!newRef || !newCreds || saving}
          >
            {saving ? 'Storing...' : 'Store credentials'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

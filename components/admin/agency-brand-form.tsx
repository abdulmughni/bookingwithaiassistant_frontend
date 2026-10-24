'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/button'
import { Field, Label } from '@/components/fieldset'
import { Input } from '@/components/input'
import { ApiError, api } from '@/lib/api'
import { brandAssetUrl } from '@/lib/brand'
import { useApiToken } from '@/lib/hooks'

export function AgencyBrandForm({ agencyId }: { agencyId: string }) {
  const getToken = useApiToken()
  const [primary, setPrimary] = useState('#3b59ff')
  const [primaryDark, setPrimaryDark] = useState('#2438e6')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [savingColors, setSavingColors] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const agency = await api.admin.getAgency(token, agencyId)
        if (cancelled) return
        if (agency.primary_color) setPrimary(agency.primary_color)
        if (agency.primary_dark_color) setPrimaryDark(agency.primary_dark_color)
        setLogoUrl(agency.logo_url)
      } catch {
        /* The page that hosts this form reports load errors. */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agencyId, getToken])

  async function saveColors() {
    setSavingColors(true)
    try {
      const token = await getToken()
      const saved = await api.admin.saveBrandColors(token, agencyId, {
        primary_color: primary,
        primary_dark_color: primaryDark,
      })
      setPrimary(saved.primary_color || primary)
      setPrimaryDark(saved.primary_dark_color || primaryDark)
      window.dispatchEvent(new Event('agency-brand-changed'))
      toast.success('Colors saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save colors.')
    } finally {
      setSavingColors(false)
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return
    setSavingLogo(true)
    try {
      const token = await getToken()
      const saved = await api.admin.uploadBrandLogo(token, agencyId, file)
      setLogoUrl(saved.logo_url)
      window.dispatchEvent(new Event('agency-brand-changed'))
      toast.success('Logo saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload the logo.')
    } finally {
      setSavingLogo(false)
    }
  }

  const preview = brandAssetUrl(logoUrl)

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-4">
        <Field>
          <Label>Main color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Main color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="size-10 cursor-pointer rounded border border-zinc-200 bg-white"
            />
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
          </div>
        </Field>
        <Field>
          <Label>Dark color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Dark color"
              value={primaryDark}
              onChange={(e) => setPrimaryDark(e.target.value)}
              className="size-10 cursor-pointer rounded border border-zinc-200 bg-white"
            />
            <Input value={primaryDark} onChange={(e) => setPrimaryDark(e.target.value)} />
          </div>
        </Field>
        <Button color="brand" disabled={savingColors} onClick={() => void saveColors()}>
          {savingColors ? 'Saving…' : 'Save colors'}
        </Button>
      </div>
      <div className="space-y-3">
        <Field>
          <Label>Logo</Label>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={savingLogo}
            onChange={(e) => void onLogo(e.target.files?.[0])}
          />
        </Field>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Agency logo" className="h-12 w-auto object-contain" />
        ) : (
          <p className="text-sm text-zinc-500">PNG, JPG, or WebP. Under 2 MB.</p>
        )}
        {savingLogo ? <p className="text-sm text-zinc-500">Uploading…</p> : null}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { ApiError, api } from '@/lib/api'
import { brandAssetUrl } from '@/lib/brand'
import {
  BRAND_PRESETS,
  CURRENT_THEME,
  THEME_ROWS,
  isHexColor,
  themesMatch,
  type BrandThemeColors,
} from '@/lib/brand-presets'
import { useColorMode } from '@/lib/color-mode'
import { readConsoleTheme, writeConsoleTheme } from '@/lib/console-theme'
import { useApiToken } from '@/lib/hooks'

function darkShell(colors: BrandThemeColors): BrandThemeColors {
  return {
    ...colors,
    page_background: '#101218',
    card_background: '#1c1e24',
    soft_background: '#262830',
    main_text: '#fafafa',
    subtext: '#a1a1aa',
    border: '#3f3f46',
  }
}

function PreviewFrame({
  title,
  colors,
  logoUrl,
}: {
  title: string
  colors: BrandThemeColors
  logoUrl: string | null
}) {
  return (
    <div>
      <p className="mb-2 px-1 text-xs font-medium text-zinc-500">{title}</p>
      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{ background: colors.page_background, borderColor: colors.border, color: colors.main_text }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: colors.border }}>
          <p className="text-xs font-medium" style={{ color: colors.subtext }}>
            Live preview
          </p>
        </div>
        <div className="flex gap-3 p-3">
          <div className="flex w-16 shrink-0 flex-col gap-3 rounded-xl p-2" style={{ background: colors.soft_background }}>
            {logoUrl ? (
              <BrandLogo src={logoUrl} alt="" height={24} className="max-w-12" />
            ) : (
              <div className="h-6 w-10 rounded" style={{ background: colors.primary }} />
            )}
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full" style={{ background: colors.primary }} />
              <div className="h-1.5 w-4/5 rounded-full" style={{ background: colors.border }} />
              <div className="h-1.5 w-3/5 rounded-full" style={{ background: colors.border }} />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="rounded-xl border p-3" style={{ background: colors.card_background, borderColor: colors.border }}>
              <p className="text-sm font-semibold">Today&apos;s jobs</p>
              <p className="mt-1 text-xs" style={{ color: colors.subtext }}>
                Updates as you change a color.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: colors.primary, color: colors.button_text }}>
                  Primary
                </span>
                <span className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: colors.accent, color: colors.button_text }}>
                  Accent
                </span>
              </div>
            </div>
            <div className="rounded-xl px-3 py-2 text-xs" style={{ background: colors.soft_background, color: colors.subtext }}>
              Soft panel
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandPreview({
  colors,
  logoUrl,
}: {
  colors: BrandThemeColors
  logoUrl: string | null
}) {
  return (
    <div className="space-y-4 rounded-2xl bg-zinc-100 p-3 ring-1 ring-zinc-200 dark:bg-black/40 dark:ring-white/10">
      <PreviewFrame title="Light" colors={colors} logoUrl={logoUrl} />
      <PreviewFrame title="Dark" colors={darkShell(colors)} logoUrl={logoUrl} />
    </div>
  )
}

function AppearanceMode() {
  const { mode, setColorMode } = useColorMode()
  const options = [
    ['light', 'Light'],
    ['dark', 'Dark'],
  ] as const
  return (
    <div>
      <p className="text-sm font-medium text-zinc-950 dark:text-white">Appearance</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Light is the default. Dark mode applies to every screen in the app, on this browser.
      </p>
      <div className="mt-3 inline-flex rounded-full bg-zinc-100 p-1 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
        {options.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setColorMode(id)}
            className={
              mode === id
                ? 'rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm dark:bg-zinc-600'
                : 'rounded-full px-4 py-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AgencyBrandForm({
  agencyId,
  showLogo = true,
  persist = 'account',
}: {
  agencyId?: string
  showLogo?: boolean
  /** Browser keeps the admin console palette on this device. Account saves to the signed-in company. */
  persist?: 'account' | 'browser'
}) {
  const getToken = useApiToken()
  const [colors, setColors] = useState<BrandThemeColors>(CURRENT_THEME)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [savingColors, setSavingColors] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (persist === 'browser') {
          if (!cancelled) setColors(readConsoleTheme())
          return
        }
        const token = await getToken()
        if (!showLogo) {
          const mine = await api.brand.me(token)
          if (cancelled) return
          if (mine.theme) setColors(mine.theme)
          setLogoUrl(mine.logo_url)
          return
        }
        const agency = await api.admin.getAgency(token, agencyId ?? '')
        if (cancelled) return
        if (agency.theme) setColors(agency.theme)
        setLogoUrl(agency.logo_url)
      } catch {
        /* The page that hosts this form reports load errors. */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agencyId, getToken, persist, showLogo])

  function setColor(key: keyof BrandThemeColors, value: string) {
    setColors((current) => ({ ...current, [key]: value }))
  }

  async function saveColors() {
    const invalid = THEME_ROWS.find((row) => !isHexColor(colors[row.key]))
    if (invalid) {
      toast.error(`${invalid.label} must be a color like #1D4ED8.`)
      return
    }
    const theme = Object.fromEntries(
      THEME_ROWS.map((row) => [row.key, colors[row.key].trim().toLowerCase()]),
    ) as BrandThemeColors
    setSavingColors(true)
    try {
      if (persist === 'browser') {
        writeConsoleTheme(theme)
        setColors(theme)
        toast.success('Colors saved')
        return
      }
      const token = await getToken()
      const saved = showLogo
        ? await api.admin.saveBrandColors(token, agencyId ?? '', theme)
        : await api.brand.saveTheme(token, theme)
      if (saved.theme) setColors(saved.theme)
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
      const saved = await api.admin.uploadBrandLogo(token, agencyId ?? '', file)
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
    <div className="space-y-6">
      <AppearanceMode />
      {showLogo ? <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {preview ? (
            <BrandLogo src={preview} alt="" height={48} className="max-h-12 max-w-14" />
          ) : (
            <span className="text-[10px] font-medium text-zinc-400">Logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-950 dark:text-white">Logo</p>
          <p className="mt-0.5 text-xs text-zinc-500">PNG, JPG, or WebP. Under 2 MB.</p>
          <Input
            className="mt-2 max-w-sm"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={savingLogo}
            onChange={(e) => void onLogo(e.target.files?.[0])}
          />
          {savingLogo ? <p className="mt-1 text-xs text-zinc-500">Uploading…</p> : null}
        </div>
      </div> : null}

      <div>
        <p className="text-sm font-medium text-zinc-950 dark:text-white">Presets</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Current is the app as it looks today. A preset fills the colors below. Nothing is saved until you save.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BRAND_PRESETS.map((preset) => {
            const selected = themesMatch(colors, preset.colors)
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setColors(preset.colors)}
                className={
                  selected
                    ? 'inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white ring-2 ring-[var(--brand-primary)] dark:bg-zinc-700'
                    : 'inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600 dark:hover:bg-zinc-700'
                }
              >
                <span className="flex gap-0.5">
                  <span className="size-3 rounded-full" style={{ background: preset.colors.primary }} />
                  <span className="size-3 rounded-full" style={{ background: preset.colors.accent }} />
                  <span className="size-3 rounded-full ring-1 ring-zinc-200" style={{ background: preset.colors.soft_background }} />
                </span>
                {preset.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {THEME_ROWS.map((row) => {
            const value = colors[row.key]
            const picker = isHexColor(value) ? value : '#000000'
            return (
              <label key={row.key} className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  aria-label={row.label}
                  value={picker}
                  onChange={(e) => setColor(row.key, e.target.value)}
                  className="size-9 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-transparent p-0 dark:border-zinc-500"
                />
                <span className="w-36 text-sm text-zinc-700 dark:text-zinc-300">{row.label}</span>
                <Input
                  value={value}
                  spellCheck={false}
                  onChange={(e) => setColor(row.key, e.target.value)}
                  className="min-w-36 flex-1 font-mono"
                />
              </label>
            )
          })}
          <Button color="brand" disabled={savingColors} onClick={() => void saveColors()}>
            {savingColors ? 'Saving…' : 'Save colors'}
          </Button>
        </div>
        <BrandPreview colors={colors} logoUrl={preview} />
      </div>
    </div>
  )
}

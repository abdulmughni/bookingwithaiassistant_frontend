'use client'

import { useEffect } from 'react'

import type { BrandThemeColors } from '@/lib/brand-presets'

/** Apply a saved agency palette to the shell. Draft colors stay in the editor preview. */
export function BrandTheme({ theme }: { theme?: BrandThemeColors | null }) {
  useEffect(() => {
    if (!theme?.primary) return
    const root = document.documentElement
    const values: Record<string, string> = {
      '--brand-page': theme.page_background,
      '--brand-card': theme.card_background,
      '--brand-soft': theme.soft_background,
      '--brand-text': theme.main_text,
      '--brand-subtext': theme.subtext,
      '--brand-button-text': theme.button_text,
      '--brand-border': theme.border,
      '--color-brand-400': theme.primary,
      '--color-brand-500': theme.primary,
      '--color-brand-600': theme.primary,
      '--color-brand-700': theme.accent,
      '--bc-brand': theme.primary,
    }
    root.dataset.agencyTheme = 'on'
    for (const [key, value] of Object.entries(values)) {
      root.style.setProperty(key, value)
    }
    return () => {
      delete root.dataset.agencyTheme
      for (const key of Object.keys(values)) root.style.removeProperty(key)
    }
  }, [theme])

  return null
}

'use client'

import { useEffect, useState } from 'react'

import { CURRENT_THEME, type BrandThemeColors } from '@/lib/brand-presets'

export const CONSOLE_THEME_KEY = 'platform-console-theme'

export function readConsoleTheme(): BrandThemeColors {
  if (typeof window === 'undefined') return CURRENT_THEME
  try {
    const raw = window.localStorage.getItem(CONSOLE_THEME_KEY)
    if (!raw) return CURRENT_THEME
    const parsed = JSON.parse(raw) as BrandThemeColors
    if (parsed?.primary) return parsed
  } catch {
    /* Keep the default palette if the saved value is unreadable. */
  }
  return CURRENT_THEME
}

export function writeConsoleTheme(theme: BrandThemeColors) {
  window.localStorage.setItem(CONSOLE_THEME_KEY, JSON.stringify(theme))
  window.dispatchEvent(new Event('agency-brand-changed'))
}

export function useConsoleTheme() {
  const [theme, setTheme] = useState<BrandThemeColors>(CURRENT_THEME)
  useEffect(() => {
    const read = () => setTheme(readConsoleTheme())
    read()
    window.addEventListener('agency-brand-changed', read)
    return () => window.removeEventListener('agency-brand-changed', read)
  }, [])
  return theme
}

'use client'

import { useEffect } from 'react'

/** Apply an agency's two colors to the shared brand tokens for this screen. */
export function BrandTheme({
  primary,
  primaryDark,
}: {
  primary?: string | null
  primaryDark?: string | null
}) {
  useEffect(() => {
    if (!primary) return
    const dark = primaryDark || primary
    const root = document.documentElement
    const values: Record<string, string> = {
      '--color-brand-400': primary,
      '--color-brand-500': primary,
      '--color-brand-600': primary,
      '--color-brand-700': dark,
      '--bc-brand': primary,
    }
    for (const [key, value] of Object.entries(values)) {
      root.style.setProperty(key, value)
    }
    return () => {
      for (const key of Object.keys(values)) root.style.removeProperty(key)
    }
  }, [primary, primaryDark])

  return null
}

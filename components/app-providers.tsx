'use client'

import { ClerkProvider } from '@clerk/nextjs'
import type { ReactNode } from 'react'

import { useColorMode } from '@/lib/color-mode'

const darkAppearance = {
  variables: {
    colorBackground: '#18181b',
    colorText: '#fafafa',
    colorTextSecondary: '#a1a1aa',
    colorInputBackground: '#27272a',
    colorInputText: '#fafafa',
    colorNeutral: '#a1a1aa',
  },
}

export function AppProviders({ children }: { children: ReactNode }) {
  const { mode } = useColorMode()
  return <ClerkProvider appearance={mode === 'dark' ? darkAppearance : undefined}>{children}</ClerkProvider>
}

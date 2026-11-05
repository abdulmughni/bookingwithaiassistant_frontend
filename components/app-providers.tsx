'use client'

import { ClerkProvider } from '@clerk/nextjs'
import type { ComponentProps } from 'react'
import { useEffect, useState, type ReactNode } from 'react'

type ClerkAppearance = ComponentProps<typeof ClerkProvider>['appearance']

import { useColorMode, type ColorMode } from '@/lib/color-mode'

function brandValue(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Clerk account modal for admin, agency, and client. Matches the saved palette and blocks lockout. */
function accountAppearance(mode: ColorMode): ClerkAppearance {
  const dark = mode === 'dark'
  const primary = brandValue('--brand-primary', '#3B59FF')
  const buttonText = brandValue('--brand-button-text', '#ffffff')
  const border = dark ? '#3f3f46' : brandValue('--brand-border', '#e4e4e7')
  return {
    variables: {
      colorPrimary: primary,
      colorTextOnPrimaryBackground: buttonText,
      colorBackground: dark ? '#16181e' : brandValue('--brand-card', '#ffffff'),
      colorText: dark ? '#fafafa' : brandValue('--brand-text', '#18181b'),
      colorTextSecondary: dark ? '#a1a1aa' : brandValue('--brand-subtext', '#71717a'),
      colorInputBackground: dark ? '#1c1e24' : brandValue('--brand-soft', '#f4f4f5'),
      colorInputText: dark ? '#fafafa' : brandValue('--brand-text', '#18181b'),
      colorNeutral: dark ? '#d4d4d8' : brandValue('--brand-subtext', '#52525b'),
      borderRadius: '0.9rem',
      fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    },
    elements: {
      modalBackdrop: { backdropFilter: 'blur(6px)' },
      modalContent: {
        borderRadius: '1.25rem',
        border: `1px solid ${border}`,
        boxShadow: dark ? '0 24px 80px rgb(0 0 0 / 0.5)' : '0 24px 70px rgb(24 24 27 / 0.16)',
      },
      cardBox: { boxShadow: 'none', borderRadius: '1.25rem' },
      card: { boxShadow: 'none' },
      navbar: {
        background: dark ? '#12141a' : brandValue('--brand-soft', '#f4f4f5'),
        borderRight: `1px solid ${border}`,
      },
      navbarButton: { borderRadius: '0.75rem' },
      profileSection: { borderRadius: '0.9rem' },
      formButtonPrimary: { borderRadius: '0.75rem' },
      // The only login email must stay. Removing it locks the person out.
      menuButton__emailAddresses: { display: 'none' },
      // Self-serve delete would drop the portal login and leave the workspace behind.
      profileSection__danger: { display: 'none' },
    },
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const { mode } = useColorMode()
  const [appearance, setAppearance] = useState<ClerkAppearance>(undefined)

  useEffect(() => {
    const apply = () => setAppearance(accountAppearance(mode))
    apply()
    window.addEventListener('agency-brand-changed', apply)
    return () => window.removeEventListener('agency-brand-changed', apply)
  }, [mode])

  return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>
}

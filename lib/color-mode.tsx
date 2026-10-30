'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'color-mode'

export type ColorMode = 'light' | 'dark'

export function readColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function applyColorMode(mode: ColorMode) {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.style.colorScheme = mode
}

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>('light')

  useEffect(() => {
    const sync = () => {
      const next = readColorMode()
      setMode(next)
      applyColorMode(next)
    }
    sync()
    window.addEventListener('color-mode-changed', sync)
    return () => window.removeEventListener('color-mode-changed', sync)
  }, [])

  function setColorMode(next: ColorMode) {
    window.localStorage.setItem(STORAGE_KEY, next)
    applyColorMode(next)
    setMode(next)
    window.dispatchEvent(new Event('color-mode-changed'))
  }

  return { mode, setColorMode }
}

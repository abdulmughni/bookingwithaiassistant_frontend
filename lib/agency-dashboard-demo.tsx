'use client'

import { useEffect, useState } from 'react'

import type { AgencyActivity } from '@/lib/types'

const STORAGE_KEY = 'agency-dashboard-demo'

/** Sample rows for UI testing. Delete this file when the real dashboard is signed off. */
export const agencyDemo = {
  subtitle: "Here's an overview of your clients, bookings, and AI performance.",
  rangeLabel: 'Oct 1, 2026 – Oct 24, 2026',
  kpis: [
    { label: 'Total clients', value: '5', trend: '2 this month' },
    { label: 'Total bookings', value: '128', trend: '18% from last month' },
    { label: 'Call minutes', value: '642', trend: '22% from last month' },
    { label: 'Messages', value: '284', trend: '16% from last month' },
    { label: 'Revenue this month', value: '$1,240', trend: '28% from last month' },
  ],
  plan: {
    name: 'Professional',
    clientsLabel: '3 / 10 clients',
    clientsPct: 30,
    minutesLabel: '12,450 / 50,000 mins',
    minutesPct: 25,
  },
  clients: [
    { id: 'skyline', name: 'Skyline HVAC', industry: 'hvac', bookings: 42, calls: 210, messages: 88, status: 'Active' as const },
    { id: 'roof', name: 'Instamate Roofing', industry: 'roofing', bookings: 28, calls: 165, messages: 60, status: 'Active' as const },
    { id: 'plumb', name: 'Instamate Plumbing', industry: 'plumbing', bookings: 16, calls: 120, messages: 55, status: 'Active' as const },
    { id: 'elec', name: 'Instamate Electrical', industry: 'electrical', bookings: 16, calls: 98, messages: 42, status: 'Active' as const },
    { id: 'one', name: 'Client One', industry: 'general', bookings: 12, calls: 49, messages: 39, status: 'Pending' as const },
  ],
  signups: [
    { id: 'one', name: 'Client One', industry: 'general', joined: 'Joined Oct 24, 2026', status: 'Pending' as const },
    { id: 'skyline', name: 'Skyline HVAC', industry: 'hvac', joined: 'Joined Oct 21, 2026', status: 'Active' as const },
    { id: 'roof', name: 'Instamate Roofing', industry: 'roofing', joined: 'Joined Oct 18, 2026', status: 'Active' as const },
    { id: 'elec', name: 'Instamate Electrical', industry: 'electrical', joined: 'Joined Oct 18, 2026', status: 'Active' as const },
    { id: 'plumb', name: 'Instamate Plumbing', industry: 'plumbing', joined: 'Joined Oct 16, 2026', status: 'Active' as const },
  ],
  attention: [
    { id: 'a1', name: 'Client One', detail: 'Plan activation pending', when: '2 hours ago', tone: 'red' as const },
    { id: 'a2', name: 'Skyline HVAC', detail: 'AI minutes running low (85%)', when: '4 hours ago', tone: 'amber' as const },
    { id: 'a3', name: 'Instamate Roofing', detail: '3 unread customer messages', when: '6 hours ago', tone: 'amber' as const },
    { id: 'a4', name: 'Instamate Plumbing', detail: 'Payment failed', when: '1 day ago', tone: 'red' as const },
    { id: 'a5', name: 'Instamate Electrical', detail: 'Missed calls (5)', when: '1 day ago', tone: 'red' as const },
  ],
  attentionCount: 3,
  activity: [
    { id: 'e1', title: 'New client signed up: Client One', detail: '', when: '2 hours ago', tone: 'green' as const },
    { id: 'e2', title: 'New booking: Skyline HVAC', detail: '', when: '3 hours ago', tone: 'blue' as const },
    { id: 'e3', title: 'Call completed: Instamate Roofing', detail: 'Duration: 4m 32s', when: '4 hours ago', tone: 'blue' as const },
    { id: 'e4', title: 'New message: Instamate Electrical', detail: '“Can we schedule for next week?”', when: '6 hours ago', tone: 'violet' as const },
    { id: 'e5', title: 'Plan activated: Instamate Plumbing', detail: '', when: '1 day ago', tone: 'green' as const },
  ],
}

const demoHeights = [6, 10, 12, 16, 14, 20, 18, 22, 16, 24, 20, 26, 22, 28, 24, 16, 20, 26, 22, 30, 18, 24, 28, 16]

export function agencyDemoSeries(): AgencyActivity['series'] {
  return demoHeights.map((total, index) => {
    const day = index + 1
    const light = Math.round(total * 0.42)
    return {
      date: `2026-10-${String(day).padStart(2, '0')}`,
      bookings: light,
      calls: total - light,
      messages: 0,
    }
  })
}

export function useAgencyDemo() {
  const [enabled, setEnabled] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => setEnabled(window.localStorage.getItem(STORAGE_KEY) !== 'off')
    read()
    setReady(true)
    window.addEventListener('agency-demo-changed', read)
    return () => window.removeEventListener('agency-demo-changed', read)
  }, [])

  function setDemo(next: boolean) {
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
    setEnabled(next)
    window.dispatchEvent(new Event('agency-demo-changed'))
  }

  return { enabled, ready, setDemo }
}

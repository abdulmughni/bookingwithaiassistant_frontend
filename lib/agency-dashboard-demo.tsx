'use client'

import { useEffect, useState } from 'react'

import type { AgencyActivity } from '@/lib/types'

const STORAGE_KEY = 'agency-dashboard-demo'

/** Sample rows for UI testing. Delete this file when the real dashboard is signed off. */
export const agencyDemo = {
  subtitle: "Here's an overview of your clients, bookings, and AI performance.",
  rangeLabel: 'Oct 1, 2026 – Oct 24, 2026',
  kpis: [
    { label: 'Total clients', value: '9', trend: '4 this month' },
    { label: 'Total bookings', value: '128', trend: '18% from last month' },
    { label: 'Call minutes', value: '642', trend: '22% from last month' },
    { label: 'Messages', value: '284', trend: '8% from last month' },
    { label: 'Client job value', value: '$1,240', trend: 'Sample · estimates on client jobs, not pack fees' },
  ],
  plan: {
    name: 'Professional',
    clientsLabel: '3 / 10 clients',
    clientsPct: 30,
    minutesLabel: '12,450 / 50,000 mins',
    minutesPct: 25,
  },
  clients: [
    { id: 'skyline', name: 'Skyline HVAC', industry: 'hvac', image: demoLogo('SkylineHVAC'), created: '2026-10-21', bookings: 42, calls: 210, messages: 88, revenue: '$420', status: 'Active' as const, trend: [2, 3, 3, 4, 5, 6] },
    { id: 'roof', name: 'Instamate Roofing', industry: 'roofing', image: demoLogo('InstamateRoofing'), created: '2026-10-18', bookings: 28, calls: 165, messages: 60, revenue: '$320', status: 'Active' as const, trend: [2, 2, 3, 3, 4, 5] },
    { id: 'plumb', name: 'Instamate Plumbing', industry: 'plumbing', image: demoLogo('InstamatePlumbing'), created: '2026-10-16', bookings: 16, calls: 120, messages: 55, revenue: '$210', status: 'Active' as const, trend: [1, 2, 2, 3, 3, 4] },
    { id: 'elec', name: 'Instamate Electrical', industry: 'electrical', image: demoLogo('InstamateElectrical'), created: '2026-10-18', bookings: 16, calls: 98, messages: 42, revenue: '$180', status: 'Active' as const, trend: [1, 1, 2, 2, 3, 3] },
    { id: 'one', name: 'Client One', industry: 'general', image: '', created: '2026-10-24', bookings: 12, calls: 49, messages: 39, revenue: '$120', status: 'Pending' as const, trend: [3, 2, 2, 1, 2, 1] },
    { id: 'bright', name: 'Bright Home Services', industry: 'general', image: demoLogo('BrightHome'), created: '2026-10-14', bookings: 11, calls: 44, messages: 30, revenue: '$110', status: 'Active' as const, trend: [1, 2, 2, 3, 3, 4] },
    { id: 'north', name: 'Northstar Painting', industry: 'general', image: demoLogo('Northstar'), created: '2026-10-12', bookings: 9, calls: 36, messages: 22, revenue: '$90', status: 'Active' as const, trend: [2, 2, 1, 3, 2, 3] },
    { id: 'harbor', name: 'Harbor Glass', industry: 'general', image: demoLogo('HarborGlass'), created: '2026-10-09', bookings: 8, calls: 28, messages: 18, revenue: '$80', status: 'Pending' as const, trend: [2, 1, 2, 1, 2, 1] },
    { id: 'metro', name: 'Metro Locksmith', industry: 'general', image: demoLogo('MetroLock'), created: '2026-10-07', bookings: 6, calls: 21, messages: 14, revenue: '$60', status: 'Active' as const, trend: [1, 1, 2, 2, 3, 3] },
  ],
  signups: [
    { id: 'one', name: 'Client One', industry: 'general', image: '', joined: 'Joined Oct 24, 2026', status: 'Pending' as const },
    { id: 'skyline', name: 'Skyline HVAC', industry: 'hvac', image: demoLogo('SkylineHVAC'), joined: 'Joined Oct 21, 2026', status: 'Active' as const },
    { id: 'roof', name: 'Instamate Roofing', industry: 'roofing', image: demoLogo('InstamateRoofing'), joined: 'Joined Oct 18, 2026', status: 'Active' as const },
    { id: 'elec', name: 'Instamate Electrical', industry: 'electrical', image: demoLogo('InstamateElectrical'), joined: 'Joined Oct 18, 2026', status: 'Active' as const },
    { id: 'plumb', name: 'Instamate Plumbing', industry: 'plumbing', image: demoLogo('InstamatePlumbing'), joined: 'Joined Oct 16, 2026', status: 'Active' as const },
    { id: 'bright', name: 'Bright Home Services', industry: 'general', image: demoLogo('BrightHome'), joined: 'Joined Oct 14, 2026', status: 'Active' as const },
    { id: 'north', name: 'Northstar Painting', industry: 'general', image: demoLogo('Northstar'), joined: 'Joined Oct 12, 2026', status: 'Pending' as const },
    { id: 'harbor', name: 'Harbor Glass', industry: 'general', image: demoLogo('HarborGlass'), joined: 'Joined Oct 9, 2026', status: 'Active' as const },
  ],
  attention: [
    { id: 'a1', name: 'Client One', detail: 'Plan activation pending', when: '2 hours ago', tone: 'red' as const, image: '' },
    { id: 'a2', name: 'Skyline HVAC', detail: 'AI minutes running low (85%)', when: '4 hours ago', tone: 'amber' as const, image: demoLogo('SkylineHVAC') },
    { id: 'a3', name: 'Instamate Roofing', detail: '3 unread customer messages', when: '6 hours ago', tone: 'amber' as const, image: demoLogo('InstamateRoofing') },
    { id: 'a4', name: 'Instamate Plumbing', detail: 'Payment failed', when: '1 day ago', tone: 'red' as const, image: demoLogo('InstamatePlumbing') },
    { id: 'a5', name: 'Instamate Electrical', detail: 'Missed calls (5)', when: '1 day ago', tone: 'red' as const, image: demoLogo('InstamateElectrical') },
    { id: 'a6', name: 'Bright Home Services', detail: 'Calendar not connected', when: '2 days ago', tone: 'amber' as const, image: demoLogo('BrightHome') },
    { id: 'a7', name: 'Harbor Glass', detail: 'Setup still incomplete', when: '3 days ago', tone: 'red' as const, image: demoLogo('HarborGlass') },
  ],
  attentionCount: 3,
  activity: [
    { id: 'e1', title: 'New client signed up: Client One', detail: '', when: '2 hours ago', tone: 'green' as const },
    { id: 'e2', title: 'New booking: Skyline HVAC', detail: '', when: '3 hours ago', tone: 'blue' as const },
    { id: 'e3', title: 'Call completed: Instamate Roofing', detail: 'Duration: 4m 32s', when: '4 hours ago', tone: 'blue' as const },
    { id: 'e4', title: 'New message: Instamate Electrical', detail: '“Can we schedule for next week?”', when: '6 hours ago', tone: 'violet' as const },
    { id: 'e5', title: 'Plan activated: Instamate Plumbing', detail: '', when: '1 day ago', tone: 'green' as const },
    { id: 'e6', title: 'New booking: Bright Home Services', detail: '', when: '1 day ago', tone: 'blue' as const },
    { id: 'e7', title: 'New message: Harbor Glass', detail: '“Can you come Thursday?”', when: '2 days ago', tone: 'violet' as const },
    { id: 'e8', title: 'Call completed: Metro Locksmith', detail: 'Duration: 6m 10s', when: '2 days ago', tone: 'blue' as const },
  ],
}

function demoLogo(seed: string) {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}`
}

const demoHeights = [6, 10, 12, 16, 14, 20, 18, 22, 16, 24, 20, 26, 22, 28, 24, 16, 20, 26, 22, 30, 18, 24, 28, 16]

export function agencyDemoSeries(): AgencyActivity['series'] {
  return demoHeights.map((total, index) => {
    const day = index + 1
    const bookings = Math.round(total * 0.34)
    const calls = Math.round(total * 0.4)
    return {
      date: `2026-10-${String(day).padStart(2, '0')}`,
      bookings,
      calls,
      messages: Math.max(0, total - bookings - calls),
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

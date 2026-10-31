'use client'

import { AgencyBookings } from '@/components/admin/agency-bookings'
import { AgencyOnly } from '@/components/admin/agency-only'

export default function AgencyActivityPage() {
  return (
    <AgencyOnly>
      <AgencyBookings />
    </AgencyOnly>
  )
}

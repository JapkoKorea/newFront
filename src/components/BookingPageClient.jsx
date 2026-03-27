'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaxiBooking from '@/components/TaxiBooking.jsx'
import { clearTourBookingPrefill, loadTourBookingPrefill } from '@/lib/bookingPrefill.js'

export default function BookingPageClient() {
  const router = useRouter()
  const [initialDraft, setInitialDraft] = useState(null)

  useEffect(() => {
    const prefill = loadTourBookingPrefill()
    if (prefill) {
      setInitialDraft(prefill)
      clearTourBookingPrefill()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <TaxiBooking
          displayMode="page"
          isOpen
          onClose={() => router.push('/tours')}
          initialDraft={initialDraft}
        />
      </div>
    </div>
  )
}

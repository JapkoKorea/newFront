'use client'

import { useRouter } from 'next/navigation'
import TransferBooking from '@/components/TransferBooking.jsx'

export default function TransferBookingPageClient() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <TransferBooking
          displayMode="page"
          isOpen
          onClose={() => router.push('/tours')}
        />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaxiBooking from '@/components/TaxiBooking.jsx'
import { clearTourBookingPrefill, loadTourBookingPrefill } from '@/lib/bookingPrefill.js'

export default function BookingPageClient() {
  const router = useRouter()
  // prefill 은 sessionStorage 에서 동기적으로 읽는다.
  // 첫 렌더에 알아야 코스 선택 단계를 보여줄지 결정할 수 있다.
  const [initialDraft, setInitialDraft] = useState(() => loadTourBookingPrefill())
  const hasPrefill = Boolean(initialDraft)

  useEffect(() => {
    // 뒤로 가기로 재진입했을 때 오래된 prefill 이 남지 않도록 한 번 쓰고 지운다.
    if (hasPrefill) clearTourBookingPrefill()
  }, [hasPrefill])

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <TaxiBooking
          displayMode="page"
          isOpen
          onClose={() => router.push('/products')}
          initialDraft={initialDraft}
          hasPrefill={hasPrefill}
        />
      </div>
    </div>
  )
}

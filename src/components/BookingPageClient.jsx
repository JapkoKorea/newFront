'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaxiBooking from '@/components/TaxiBooking.jsx'
import { clearTourBookingPrefill, loadTourBookingPrefill } from '@/lib/bookingPrefill.js'

// 코스 맥락 유무는 URL 쿼리(from=product)로 서버에서 이미 판단해 넘겨받는다.
// prefill 자체는 sessionStorage 에 있어 클라이언트에서만 읽을 수 있지만,
// "어느 단계를 그릴지"는 첫 렌더부터 확정되므로 화면이 바뀌지 않는다.
export default function BookingPageClient({ fromProduct = false }) {
  const router = useRouter()
  const [initialDraft, setInitialDraft] = useState(null)

  useEffect(() => {
    const prefill = loadTourBookingPrefill()
    if (!prefill) return
    setInitialDraft(prefill)
    // 뒤로 가기로 재진입했을 때 오래된 값이 남지 않도록 한 번 쓰고 지운다.
    clearTourBookingPrefill()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        <TaxiBooking
          displayMode="page"
          isOpen
          onClose={() => router.push('/products')}
          initialDraft={initialDraft}
          hasPrefill={fromProduct}
        />
      </div>
    </div>
  )
}

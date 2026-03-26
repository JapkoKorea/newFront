'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const PaymentSuccessPage = dynamic(
  () => import('@/components/PaymentSuccessPage.jsx'),
  { ssr: false }
)

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20"><p className="text-gray-500">로딩 중...</p></div>}>
      <PaymentSuccessPage />
    </Suspense>
  )
}

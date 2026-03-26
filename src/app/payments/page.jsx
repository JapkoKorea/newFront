'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const PaymentPage = dynamic(
  () => import('@/components/PaymentPage.jsx'),
  { ssr: false }
)

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20"><p className="text-gray-500">로딩 중...</p></div>}>
      <PaymentPage />
    </Suspense>
  )
}

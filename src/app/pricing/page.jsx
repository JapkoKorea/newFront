'use client'

import dynamic from 'next/dynamic'

const PricingDepositPage = dynamic(
  () => import('@/components/PricingDepositPage.jsx'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    ),
  }
)

export default function Page() {
  return <PricingDepositPage />
}

import { Suspense } from 'react'
import { listProducts } from '@/products/registry.js'
import ProductsPageClient from './ProductsPageClient.jsx'

export const metadata = {
  title: '투어 상품',
  description: '비에이 지역 계절별 택시투어 상품을 확인하고 예약하세요.',
}

export default function ProductsPage() {
  const products = listProducts()

  return (
    <div className="min-h-screen bg-white px-4 pt-20 pb-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">투어 상품</h1>
        <p className="mt-2 text-gray-600">비에이 지역 택시투어 상품을 확인하고 예약하세요.</p>

        <Suspense fallback={<p className="mt-8 text-sm text-gray-500">상품을 불러오는 중...</p>}>
          <ProductsPageClient products={products} />
        </Suspense>
      </div>
    </div>
  )
}

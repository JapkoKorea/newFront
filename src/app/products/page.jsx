import { listProducts } from '@/products/registry.js'
import ProductsPageClient from './ProductsPageClient.jsx'

// 쿼리(season, q)를 서버에서 읽어 그대로 넘긴다.
// useSearchParams + Suspense 조합은 정적 프리렌더에서 경계가 풀리지 않아
// "상품을 불러오는 중"에서 멈추는 문제가 있었다.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '투어 상품',
  description: '비에이 지역 계절별 택시투어 상품을 확인하고 예약하세요.',
}

export default async function ProductsPage({ searchParams }) {
  const params = await searchParams
  const products = listProducts()

  return (
    <div className="min-h-screen bg-white px-4 pt-20 pb-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">투어 상품</h1>
        <p className="mt-2 text-gray-600">비에이 지역 택시투어 상품을 확인하고 예약하세요.</p>

        <ProductsPageClient
          products={products}
          initialSeason={params?.season ?? null}
          initialQuery={params?.q ?? ''}
        />
      </div>
    </div>
  )
}

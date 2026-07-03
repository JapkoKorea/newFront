import { listProducts } from '@/products/registry.js'
import ProductCard from '@/components/ProductCard.jsx'

export const metadata = {
  title: '투어 상품 | 잽코 택시투어',
  description: '비에이 지역 계절별 택시투어 상품을 확인하고 예약하세요.',
}

export default function ProductsPage() {
  const products = listProducts()

  return (
    <div className="min-h-screen bg-white px-4 pt-20 pb-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">투어 상품</h1>
        <p className="mt-2 text-gray-600">비에이 지역 택시투어 상품을 확인하고 예약하세요.</p>

        {products.length === 0 ? (
          <p className="mt-16 text-center text-gray-500">등록된 상품이 없습니다.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

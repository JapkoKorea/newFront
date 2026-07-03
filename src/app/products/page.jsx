import Link from 'next/link'
import { listProducts } from '@/products/registry.js'

export const metadata = {
  title: '상품 | 잽코 택시투어',
  description: '잽코 택시투어 상품 목록',
}

const SEASON_LABEL = { winter: '겨울', summer: '여름', all_season: '사계절' }

export default function ProductsPage() {
  const products = listProducts()

  return (
    <div className="min-h-screen bg-white px-4 pt-20 pb-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">상품</h1>
        <p className="mt-2 text-gray-600">잽코 택시투어 상품을 확인하고 예약하세요.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="group overflow-hidden rounded-2xl border border-gray-200 transition hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.heroImage}
                alt={product.heroImageAlt}
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-yellow-600">
                    {SEASON_LABEL[product.season]}
                  </span>
                  {product.badge ? (
                    <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-semibold text-gray-900">
                      {product.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-semibold text-gray-900 group-hover:text-yellow-600">
                  {product.name}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{product.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

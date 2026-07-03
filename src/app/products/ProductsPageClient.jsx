'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import ProductCard from '@/components/ProductCard.jsx'

// 시즌 필터 탭. value === null 은 '전체'.
const SEASON_TABS = [
  { value: null, label: '전체' },
  { value: 'winter', label: '겨울' },
  { value: 'summer', label: '여름' },
  { value: 'all_season', label: '사계절' },
]

const VALID_SEASONS = ['winter', 'summer', 'all_season']

export default function ProductsPageClient({ products }) {
  const searchParams = useSearchParams()
  const seasonParam = searchParams.get('season')
  const [season, setSeason] = useState(
    VALID_SEASONS.includes(seasonParam) ? seasonParam : null
  )
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((product) => {
      if (season && product.season !== season) return false
      if (!q) return true
      const haystack = [product.name, product.summary, ...(product.courseSpots ?? [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [products, season, query])

  return (
    <div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {SEASON_TABS.map((tab) => {
            const active = season === tab.value
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setSeason(tab.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-yellow-400 text-gray-900'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="코스, 지역, 관광지 검색"
            className="w-full rounded-full border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-yellow-400"
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500">{filtered.length}개 상품</p>

      {filtered.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm font-medium text-gray-700">조건에 맞는 상품이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-500">다른 시즌이나 검색어로 다시 찾아보세요.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

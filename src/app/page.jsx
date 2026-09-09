'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button.jsx'
import { ChevronDown, MapPin, Clock, Users, Star, ChevronRight, Search, Plane } from 'lucide-react'
import RecentReviews from '@/components/RecentReviews.jsx'
import ProductCard from '@/components/ProductCard.jsx'
import { fetchReviewSummaries } from '@/lib/reviews.js'
import { listProducts } from '@/products/registry.js'

const FEATURED_PRODUCTS = listProducts().slice(0, 3)

const SEASON_CHIPS = [
  { season: null, label: '전체' },
  { season: 'winter', label: '겨울' },
  { season: 'summer', label: '여름' },
]

const FEATURES = [
  { Icon: MapPin, title: '맞춤형 코스', body: '원하는 장소와 시간에 맞춘 개인 맞춤 투어' },
  { Icon: Clock, title: '시간 절약', body: '대중교통 이용 시간을 대폭 단축' },
  { Icon: Users, title: '전문 가이드', body: '현지 문화와 역사를 아는 전문 가이드' },
  { Icon: Star, title: '프리미엄 서비스', body: '깨끗하고 안전한 차량으로 편안한 여행' },
]

/** 이 수보다 후기가 적으면 평점 배지를 아예 띄우지 않는다. 표본이 적은 평균은 오해를 부른다. */
const MIN_REVIEWS_FOR_BADGE = 5

import biei1 from '@/assets/aDohz2bMGHYN.jpg'

export default function HomePage() {
  const router = useRouter()
  const [homeQuery, setHomeQuery] = useState('')
  const [productRatings, setProductRatings] = useState({})

  // 추천 카드 평점. 상품별 요약을 한 번에 받아 나눠 준다.
  useEffect(() => {
    fetchReviewSummaries().then(setProductRatings)
  }, [])

  // 전체 평점은 상품별 요약을 가중평균해서 만든다. 별도 API를 두지 않기 위함.
  const overallRating = useMemo(() => {
    const summaries = Object.values(productRatings).filter((s) => s && s.count > 0)
    const count = summaries.reduce((sum, s) => sum + s.count, 0)
    if (count < MIN_REVIEWS_FOR_BADGE) return null
    const weighted = summaries.reduce((sum, s) => sum + s.average * s.count, 0)
    return { average: weighted / count, count }
  }, [productRatings])

  const submitSearch = (e) => {
    e.preventDefault()
    const q = homeQuery.trim()
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <div>
      {/* 히어로. 화면을 다 채우지 않아야 아래 상품 피드가 살짝 보여 스크롤을 유도한다. */}
      <section className="relative flex min-h-[78svh] items-center justify-center md:min-h-[70svh]">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${biei1.src})` }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 py-24 text-center text-white">
          <p className="mb-5 text-sm font-medium tracking-[0.25em] text-yellow-300 md:text-base">
            비에이 · 후라노 전문 택시투어
          </p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance md:text-6xl">
            믿고 부르는 가장 편리한
            <br />
            <span className="text-yellow-400">잽코 택시투어</span>
          </h1>
          <p className="mx-auto mb-9 max-w-2xl text-lg text-pretty opacity-90 md:text-xl">
            복잡함은 빼고 효율만 남겼습니다. 일본 여행객을 위한 전문 택시투어 서비스를 지금 소개합니다.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-yellow-500 px-8 py-6 text-base font-semibold text-white hover:bg-yellow-600"
          >
            <Link href="#products">택시투어 예약하기</Link>
          </Button>
        </div>

        <ChevronDown
          size={32}
          aria-hidden="true"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-white motion-reduce:animate-none"
        />
      </section>

      {/* 상품 피드. commerce-first라 히어로 바로 다음에 둔다. */}
      <section id="products" className="scroll-mt-20 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">어디로 가세요?</h2>
            <p className="mt-2 text-gray-600">비에이의 계절별 인기 택시투어를 만나보세요.</p>
          </div>

          {/* 검색바 */}
          <form onSubmit={submitSearch} className="relative max-w-2xl">
            <label htmlFor="home-search" className="sr-only">
              코스, 지역, 관광지 검색
            </label>
            <Search
              aria-hidden="true"
              className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            />
            <input
              id="home-search"
              name="q"
              type="search"
              autoComplete="off"
              value={homeQuery}
              onChange={(e) => setHomeQuery(e.target.value)}
              placeholder="코스, 지역, 관광지 검색"
              className="h-14 w-full rounded-full border border-gray-300 pl-12 pr-28 text-base outline-none focus:border-yellow-400 lg:h-12"
            />
            <Button
              type="submit"
              className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-full bg-yellow-500 px-6 text-white hover:bg-yellow-600 lg:h-9"
            >
              검색
            </Button>
          </form>

          {/* 시즌 필터칩 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {SEASON_CHIPS.map((chip) => (
              <Link
                key={chip.label}
                href={chip.season ? `/products?season=${chip.season}` : '/products'}
                className="inline-flex min-h-11 items-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-yellow-50 hover:text-yellow-700"
              >
                {chip.label}
              </Link>
            ))}
          </div>

          <div className="mb-4 mt-8 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">추천 상품</h3>
            <Link
              href="/products"
              className="flex min-h-11 items-center text-sm font-medium text-yellow-600 hover:text-yellow-700"
            >
              전체보기
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {/* 상품이 둘뿐일 때 3열이면 오른쪽 한 칸이 빈다. 개수에 맞춰 열을 정한다. */}
          <div
            className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
              FEATURED_PRODUCTS.length > 2 ? 'lg:grid-cols-3' : 'lg:max-w-4xl'
            }`}
          >
            {FEATURED_PRODUCTS.map((product) => (
              <ProductCard key={product.slug} product={product} rating={productRatings[product.slug]} />
            ))}
          </div>
        </div>
      </section>

      {/* 신뢰 스트립. 예전 소개 섹션을 한 줄 밴드로 압축한 것. */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="max-w-2xl text-gray-600">
              현지 전문 가이드가 동행하여 비에이의 숨겨진 명소부터 유명 관광지까지 안전하고 편안하게
              안내해드립니다. 언어 걱정 없이 일본 여행을 즐기세요.
            </p>
            {overallRating && (
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <Star className="h-4 w-4 fill-current text-yellow-400" aria-hidden="true" />
                <span className="font-semibold tabular-nums">{overallRating.average.toFixed(1)}</span>
                <span className="text-gray-500 tabular-nums">후기 {overallRating.count}건</span>
              </p>
            )}
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {FEATURES.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon className="h-6 w-6 shrink-0 text-yellow-500" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-600">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 후기 — 예약을 고민할 때 가장 먼저 찾는 것이라 상품 가까이 둔다. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <RecentReviews />

          {/* 송영(공항 이동) 배너 */}
          <button
            type="button"
            onClick={() => router.push('/transfer-booking')}
            className="mt-8 flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5 text-left transition hover:bg-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                <Plane className="h-5 w-5 text-yellow-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">공항 송영이 필요하세요?</p>
                <p className="text-sm text-gray-600">신치토세·아사히카와 공항과 호텔 간 편안한 이동</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}

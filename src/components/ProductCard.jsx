'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, Heart, Star } from 'lucide-react'
import { formatPrimaryPrice, formatDeposit, readWishlist, toggleWishlist } from '@/lib/product.js'

const SEASON_LABEL = { winter: '겨울', summer: '여름', all_season: '사계절' }

// 커머스형 상품 카드 — 홈 추천 피드와 /products 목록에서 공통 사용.
// 사진 + 시즌/badge + 제목 + 요약 + 가격 + 후기(placeholder) + 찜(로컬).
export default function ProductCard({ product }) {
  const [wished, setWished] = useState(false)

  useEffect(() => {
    setWished(readWishlist().includes(product.slug))
  }, [product.slug])

  const onToggleWish = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const next = toggleWishlist(product.slug)
    setWished(next.includes(product.slug))
  }

  const price = formatPrimaryPrice(product)
  const deposit = formatDeposit(product)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md"
    >
      <div className="relative">
        {product.heroImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.heroImage}
            alt={product.heroImageAlt}
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-100">
            <span className="text-sm font-medium text-amber-800">{product.name}</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleWish}
          aria-label={wished ? '찜 해제' : '찜하기'}
          aria-pressed={wished}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-white"
        >
          <Heart
            className={`h-5 w-5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
          />
        </button>
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-2.5 py-0.5 text-xs font-semibold text-gray-900 shadow-sm">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-yellow-600">{SEASON_LABEL[product.season]}</span>
          <span className="flex items-center gap-1 text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            {product.durationLabel}
          </span>
        </div>

        <p className="mt-1 font-semibold text-gray-900 group-hover:text-yellow-600">
          {product.name}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{product.summary}</p>

        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <Star className="h-3.5 w-3.5" />
          후기 준비중
        </div>

        <div className="mt-auto pt-3">
          {price ? (
            <p className="font-bold text-gray-900">{price}</p>
          ) : null}
          {deposit ? (
            <p className="text-xs text-gray-500">{deposit}</p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

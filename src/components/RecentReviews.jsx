'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, BadgeCheck, ChevronRight } from 'lucide-react'
import { fetchReviews, formatReviewDate } from '@/lib/reviews.js'

/**
 * 최근 후기 몇 개를 좁은 자리에 보여준다.
 *
 * 상품 상세의 ReviewList 는 평점 분포와 신고까지 붙은 전체 화면용이라,
 * 홈처럼 스쳐 지나가는 자리에는 무겁다. 여기서는 별점·한 줄·출처만 보여주고
 * 나머지는 후기 페이지로 넘긴다.
 *
 * 후기가 하나도 없으면 아무것도 그리지 않는다. 빈 자리를 만들어 두는 것보다
 * 없는 편이 낫다.
 */
export default function RecentReviews({ limit = 3, title = '고객 후기' }) {
  const [reviews, setReviews] = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let alive = true
    fetchReviews({ limit }).then((result) => {
      if (!alive) return
      setReviews(result.reviews || [])
      setSummary(result.summary || null)
    })
    return () => {
      alive = false
    }
  }, [limit])

  if (reviews.length === 0) return null

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          {summary?.count > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-gray-900">{summary.average.toFixed(1)}</span>
              이용 후기 {summary.count}건
            </p>
          ) : null}
        </div>
        <Link
          href="/reviews"
          className="flex min-h-11 items-center gap-0.5 text-sm font-medium text-gray-600 hover:text-yellow-600"
        >
          후기 더 보기
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3.5 w-3.5 ${n <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                  />
                ))}
              </span>
              <span className="text-sm font-medium text-gray-900">{review.author_display}</span>
              {review.source === 'own' ? (
                <BadgeCheck className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <span className="text-xs text-green-700">네이버</span>
              )}
            </div>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-700">{review.body}</p>
            <p className="mt-2 text-xs text-gray-400">{formatReviewDate(review.created_at)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

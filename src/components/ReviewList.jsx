'use client'

import { useEffect, useState } from 'react'
import { Star, Flag, BadgeCheck, Loader2 } from 'lucide-react'
import StarRating from '@/components/StarRating.jsx'
import { fetchReviews, formatReviewDate, reportReview } from '@/lib/reviews.js'

const PAGE_SIZE = 5

/**
 * 상품 상세의 후기 영역. 요약(평균 + 분포)과 목록을 함께 그린다.
 *
 * 후기가 아직 없을 때가 오래 갈 것이므로, 빈 상태를 "준비중"이 아니라
 * 첫 후기를 기다리는 상태로 쓴다. 예약 전환을 막지 않도록 톤을 낮춘다.
 */
export default function ReviewList({ courseIds, onSummary }) {
  // 배열 그대로 의존성에 넣으면 매 렌더 새 참조가 되어 무한 조회가 된다.
  const courseKey = (courseIds || []).join(',')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [reported, setReported] = useState({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchReviews({ courseIds, limit: 50 }).then((result) => {
      if (!alive) return
      setData(result)
      setLoading(false)
      onSummary?.(result.summary)
    })
    return () => {
      alive = false
    }
    // courseIds 배열 대신 courseKey 로 비교한다 — 배열은 매 렌더 새 참조라 무한 조회가 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey, onSummary])

  const report = async (reviewId) => {
    try {
      await reportReview(reviewId)
      setReported((prev) => ({ ...prev, [reviewId]: true }))
    } catch {
      setReported((prev) => ({ ...prev, [reviewId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        후기를 불러오는 중
      </div>
    )
  }

  const reviews = data?.reviews || []
  const summary = data?.summary || { average: 0, count: 0, distribution: {} }

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <Star className="mx-auto h-6 w-6 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-700">아직 등록된 후기가 없습니다.</p>
        <p className="mt-1 text-xs text-gray-500">
          투어를 마치신 분들의 후기가 이곳에 표시됩니다.
        </p>
      </div>
    )
  }

  const shown = expanded ? reviews : reviews.slice(0, PAGE_SIZE)
  const maxBucket = Math.max(1, ...Object.values(summary.distribution || {}).map(Number))

  return (
    <div>
      {summary.count > 0 ? (
        <div className="flex flex-col gap-6 rounded-xl bg-gray-50 p-5 sm:flex-row sm:items-center">
          <div className="text-center sm:w-32 sm:shrink-0">
            <p className="text-4xl font-bold text-gray-900">{summary.average.toFixed(1)}</p>
            <div className="mt-1 flex justify-center">
              <StarRating value={summary.average} />
            </div>
            <p className="mt-1 text-xs text-gray-500">후기 {summary.count}건</p>
          </div>

          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((score) => {
              const n = Number(summary.distribution?.[String(score)] || 0)
              return (
                <div key={score} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-6 tabular-nums">{score}점</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{ width: `${(n / maxBucket) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums">{n}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <ul className="mt-5 divide-y divide-gray-100">
        {shown.map((review) => (
          <li key={review.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <StarRating value={review.rating} />
                  <span className="text-sm font-medium text-gray-900">{review.author_display}</span>
                  {review.source === 'own' ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <BadgeCheck className="h-3 w-3" />
                      이용 완료 확인됨
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      네이버 쇼핑
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">{formatReviewDate(review.created_at)}</p>
              </div>

              {reported[review.id] ? (
                <span className="shrink-0 text-xs text-gray-400">신고 접수됨</span>
              ) : (
                <button
                  type="button"
                  onClick={() => report(review.id)}
                  className="shrink-0 rounded p-1 text-gray-300 transition hover:text-gray-500"
                  aria-label="후기 신고"
                  title="부적절한 후기 신고"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {review.tags?.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {review.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {review.body ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {review.body}
              </p>
            ) : null}

            {review.photos?.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {review.photos.map((url) => (
                  // 후기 사진은 외부 스토리지 URL 이라 next/image 도메인 설정 대상이 아니다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-lg object-cover"
                  />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {reviews.length > PAGE_SIZE && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          후기 {reviews.length - PAGE_SIZE}건 더 보기
        </button>
      ) : null}
    </div>
  )
}

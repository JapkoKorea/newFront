import { API_BASE_URL, apiFetch, apiFetchJson } from '@/lib/api.js'

/**
 * 후기 조회. 로그인 없이 열려 있어 서버 컴포넌트에서도 호출할 수 있다.
 *
 * 후기가 없거나 백엔드가 내려가 있어도 화면은 떠야 하므로
 * 실패는 빈 결과로 흡수한다 — 후기는 예약을 막는 요소가 아니다.
 */
export async function fetchReviews({ productSlug, courseId, source, limit = 20 } = {}) {
  const url = new URL(`${API_BASE_URL}/api/reviews`)
  if (productSlug) url.searchParams.set('product_slug', productSlug)
  if (courseId) url.searchParams.set('course_id', courseId)
  if (source) url.searchParams.set('source', source)
  url.searchParams.set('limit', String(limit))

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    return res.json()
  } catch {
    return { reviews: [], summary: { average: 0, count: 0, distribution: {} }, allowedTags: [] }
  }
}

export async function fetchReviewEligibility(reservationNumber) {
  const res = await apiFetch(
    `/api/reviews/eligibility/${encodeURIComponent(reservationNumber)}`,
  )
  if (!res.ok) return null
  return res.json()
}

export async function submitReview(payload) {
  const res = await apiFetchJson('/api/reviews', { method: 'POST', body: payload })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || '후기 등록에 실패했습니다.')
  return data
}

export async function reportReview(reviewId) {
  const res = await apiFetch(`/api/reviews/${reviewId}/report`, { method: 'POST' })
  if (!res.ok) throw new Error('신고에 실패했습니다.')
  return res.json()
}

/** 2026-03-04T... -> 2026.03.04 */
export function formatReviewDate(value) {
  const text = String(value || '').slice(0, 10)
  return text ? text.replaceAll('-', '.') : ''
}

/**
 * 상품별 평점 요약(product slug -> {average, count}).
 *
 * 목록 화면이 카드마다 조회하지 않도록 한 번에 받는다.
 * 실패하면 빈 객체 — 카드는 평점 줄 없이 그려진다.
 */
export async function fetchReviewSummaries() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reviews/summaries`, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    return data.summaries || {}
  } catch {
    return {}
  }
}

// 상품 상세페이지 하네스 — 레지스트리
//
// items/ 의 상품들을 한 곳에 모아 조회 함수를 제공한다.
// 새 상품을 추가하려면: items/ 에 파일을 만들고 아래 배열에 import 후 등록.
// (이 한 곳만 고치면 라우트/목록/SSG가 자동 반영된다.)

import { PRODUCT_STATUS } from './schema.js'
import winterTaxiTour from './items/winter-taxi-tour.js'
import summerTaxiTour from './items/summer-taxi-tour.js'
import summerLavenderTaxi from './items/summer-lavender-taxi.js'
import bieiHokkaidoCharter from './items/biei-hokkaido-charter.js'

/** 등록된 전체 상품 (status 무관). 새 상품은 여기에 추가. */
export const allProducts = [
  winterTaxiTour,
  summerTaxiTour,
  // 아래는 비공개(draft) 보관 — 목록에 노출되지 않는다.
  summerLavenderTaxi,
  bieiHokkaidoCharter,
]

// slug 중복 방지 — 운영 안전장치
const seen = new Set()
for (const product of allProducts) {
  if (seen.has(product.slug)) {
    throw new Error(`[products] slug 중복: "${product.slug}"`)
  }
  seen.add(product.slug)
}

/** 노출(published) 상품만, sortOrder 오름차순 정렬. */
export const publishedProducts = allProducts
  .filter((p) => p.status === PRODUCT_STATUS.PUBLISHED)
  .sort((a, b) => a.sortOrder - b.sortOrder)

/**
 * slug 로 상품 1개 조회.
 * @param {string} slug
 * @param {{ includeDrafts?: boolean }} [options]
 * @returns {import('./schema.js').Product | null}
 */
export function getProduct(slug, { includeDrafts = false } = {}) {
  const pool = includeDrafts ? allProducts : publishedProducts
  return pool.find((p) => p.slug === slug) || null
}

/**
 * 조건으로 상품 목록 조회 (목록/피드용).
 * @param {{ season?: string, includeDrafts?: boolean }} [options]
 * @returns {import('./schema.js').Product[]}
 */
export function listProducts({ season, includeDrafts = false } = {}) {
  let pool = includeDrafts
    ? [...allProducts].sort((a, b) => a.sortOrder - b.sortOrder)
    : publishedProducts
  if (season) pool = pool.filter((p) => p.season === season)
  return pool
}

/**
 * 예약이 속한 상품을 찾는다.
 *
 * 예약 화면은 상품을 거치지 않고 바로 들어올 수도 있다(내비 "예약하기").
 * 그때는 고른 코스와 투어 날짜로 상품을 되짚는다. 코스가 여름·겨울 상품에
 * 모두 들어 있으면 날짜의 시즌으로 가른다.
 *
 * @param {{ courseId?: string|null, season?: string|null }} hints
 * @returns {string|null} 상품 slug
 */
export function resolveProductSlug({ courseId, season } = {}) {
  if (!courseId) {
    // 코스를 안 골랐어도 시즌 상품은 정해진다 — 자유 코스도 상품 안의 이용이다.
    const bySeason = publishedProducts.find((p) => p.season === season)
    return bySeason?.slug || null
  }

  const owners = publishedProducts.filter((p) => (p.courseIds || []).includes(courseId))
  if (owners.length === 0) return null
  if (owners.length === 1) return owners[0].slug

  const seasonMatch = owners.find((p) => p.season === season)
  return (seasonMatch || owners[0]).slug
}

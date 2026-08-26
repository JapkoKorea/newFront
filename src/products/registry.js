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

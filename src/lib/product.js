// 상품 카드/피드용 파생값 헬퍼.
// - 가격 표기: vehicleTiers(시간당) 또는 charterPricing(전세)에서 최저가를 뽑아 라벨화.
// - 찜(wishlist): localStorage 기반 로컬 저장(1차). 추후 로그인 시 서버 동기화.

const WISHLIST_KEY = 'product_wishlist_v1'

const yen = (value) => `${Number(value).toLocaleString('ko-KR')}엔`
const won = (value) => `${Number(value).toLocaleString('ko-KR')}원`

/**
 * 카드에 노출할 대표 가격 라벨. 전세 정액이 있으면 전세 최저가, 없으면 시간당 최저가.
 * @param {import('@/products/schema.js').Product} product
 * @returns {string|null}
 */
export function formatPrimaryPrice(product) {
  const charter = product?.charterPricing ?? []
  if (charter.length > 0) {
    const min = Math.min(...charter.map((c) => c.priceJpy))
    return `${yen(min)}~`
  }
  const tiers = product?.vehicleTiers ?? []
  if (tiers.length > 0) {
    const min = Math.min(...tiers.map((t) => t.salePerHourJpy ?? t.regularPerHourJpy))
    return `시간당 ${yen(min)}~`
  }
  return null
}

/**
 * 예약금(예약 수수료) 최저가 라벨. 없으면 null.
 * @param {import('@/products/schema.js').Product} product
 * @returns {string|null}
 */
export function formatDeposit(product) {
  const fees = product?.reservationFees ?? []
  if (fees.length === 0) return null
  const min = Math.min(...fees.map((f) => f.krw))
  return `예약금 ${won(min)}~`
}

/** SSR 안전: 현재 찜 목록(slug 배열)을 읽는다. */
export function readWishlist() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WISHLIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** slug 찜 여부 토글. 변경 후 목록을 반환한다. */
export function toggleWishlist(slug) {
  if (typeof window === 'undefined') return []
  const current = readWishlist()
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug]
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next))
  } catch {
    return current
  }
  return next
}

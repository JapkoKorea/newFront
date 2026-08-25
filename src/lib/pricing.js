// 계절별 시간당 요금 (JPY) — 예약 요금 계산과 요금 안내 페이지의 공용 소스.
//
// 계절 구분(2단계):
//   - 동절기(winter): 12 ~ 3월
//   - 평시(spring):   4 ~ 11월
// 차량 유형은 예약 흐름(TaxiBooking)의 selectedVehicleType 값과 동일하게 맞춘다.

export const PRICING_SEASON = {
  WINTER: 'winter',
  SPRING: 'spring',
}

export const SEASON_LABEL = {
  winter: '동절기',
  spring: '봄·평시',
}

// 사륜구동은 같은 계절 일반차량 요금에 +5,000엔.
const FOUR_WD_SURCHARGE_JPY = 5000

// 시간당 요금표(일반/점보 확정값). 사륜구동은 아래에서 일반 + 할증으로 파생.
export const HOURLY_RATE_BY_SEASON = {
  winter: {
    '일반차량': 10370,
    '점보택시': 13130,
  },
  spring: {
    '일반차량': 8640,
    '점보택시': 10940,
  },
}

for (const rates of Object.values(HOURLY_RATE_BY_SEASON)) {
  rates['사륜구동 차량'] = rates['일반차량'] + FOUR_WD_SURCHARGE_JPY
}

/**
 * 날짜 문자열(YYYY-MM-DD 등)로 요금 계절을 판정한다. 날짜가 없거나 잘못되면 평시로 간주.
 * @param {string} [dateStr]
 * @returns {'winter' | 'spring'}
 */
export function getPricingSeason(dateStr) {
  if (!dateStr) return PRICING_SEASON.SPRING
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return PRICING_SEASON.SPRING
  const month = parsed.getMonth() + 1
  return month === 12 || month <= 3 ? PRICING_SEASON.WINTER : PRICING_SEASON.SPRING
}

/**
 * 차량 유형 + 날짜로 시간당 요금(JPY)을 반환한다.
 * @param {string} vehicleType  예: '일반차량' | '사륜구동 차량' | '점보택시'
 * @param {string} [dateStr]
 * @returns {number}
 */
export function getHourlyRate(vehicleType, dateStr) {
  const table = HOURLY_RATE_BY_SEASON[getPricingSeason(dateStr)]
  return table[vehicleType] ?? table['일반차량']
}

// ---------------------------------------------------------------------------
// 예약금(예약 수수료)
//
// 임박 예약은 배차 조율 부담이 커서 예약금이 올라간다.
// 상품 데이터(src/products/items/*.js)의 reservationFees 와 값을 맞춰야 한다.
// 실제 청구 금액은 백엔드가 결정하므로 backend/routers/payments.py 도 함께 본다.

export const BASE_DEPOSIT_KRW = 15000
export const LAST_MINUTE_DEPOSIT_KRW = 20000

// 투어일까지 남은 일수가 이 값 이하이면 임박 예약으로 본다(당일 = 0, 하루 전 = 1).
export const LAST_MINUTE_DAYS = 1

/**
 * 투어일까지 남은 일수. 날짜(자정) 기준으로 센다.
 * @param {string} tourDateStr
 * @param {Date} [now]
 * @returns {number | null} 날짜가 유효하지 않으면 null
 */
export function getDaysUntilTour(tourDateStr, now = new Date()) {
  if (!tourDateStr) return null
  const tour = new Date(tourDateStr)
  if (Number.isNaN(tour.getTime())) return null

  const tourMidnight = new Date(tour.getFullYear(), tour.getMonth(), tour.getDate())
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((tourMidnight - todayMidnight) / 86400000)
}

/** 임박 예약(당일 또는 1일 전) 여부. */
export function isLastMinuteBooking(tourDateStr, now = new Date()) {
  const days = getDaysUntilTour(tourDateStr, now)
  if (days === null) return false
  return days <= LAST_MINUTE_DAYS
}

/**
 * 투어일 기준 예약금(원). 코스별 예약금이 있으면 그 값을 기준으로 삼되,
 * 임박 예약이면 임박 예약금 아래로는 내려가지 않는다.
 * @param {string} tourDateStr
 * @param {{ baseKrw?: number, now?: Date }} [options]
 * @returns {number}
 */
export function getDepositKrw(tourDateStr, { baseKrw, now } = {}) {
  const base = Number(baseKrw) > 0 ? Number(baseKrw) : BASE_DEPOSIT_KRW
  if (!isLastMinuteBooking(tourDateStr, now || new Date())) return base
  return Math.max(base, LAST_MINUTE_DEPOSIT_KRW)
}

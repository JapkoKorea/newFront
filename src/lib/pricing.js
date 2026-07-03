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

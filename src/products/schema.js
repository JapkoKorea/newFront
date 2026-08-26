// 상품 상세페이지 하네스 — 데이터 스키마 + 검증
//
// 이 파일은 "상품 1개"의 데이터 형태를 정의하고, defineProduct()로
// 필수 필드 검증 + 기본값 주입을 수행한다. 새 상품은 items/ 아래에
// 이 스키마를 따르는 객체 하나만 추가하면 페이지가 자동 생성된다.
//
// 필드명은 DB_DESIGN.md의 courses 테이블과 정렬되어 있어, 추후 정적
// 데이터를 DB 카탈로그로 옮길 때 매핑이 단순하다.

/** 상품 노출 상태. published 만 라우트/목록에 노출된다. */
export const PRODUCT_STATUS = {
  PUBLISHED: 'published',
  DRAFT: 'draft',
}

/** 시즌 구분 (tourCourses.js의 season 값과 동일 어휘) */
export const PRODUCT_SEASON = {
  WINTER: 'winter',
  SUMMER: 'summer',
  ALL_SEASON: 'all_season',
}

/**
 * @typedef {Object} VehicleTier  차량 등급별 시간당 요금
 * @property {string} name        예: '일반 택시 (5인승 소형)'
 * @property {string} capacity    예: '4인 이하'
 * @property {number} regularPerHourJpy  정상 시간당 요금(엔)
 * @property {number} [salePerHourJpy]   할인 시간당 요금(엔, 선택)
 * @property {string} [note]      비고
 */

/**
 * @typedef {Object} CharterTier  전세(정액) 요금 — 이용 시간별 패키지 요금
 * @property {string} durationLabel  예: '4시간 전세'
 * @property {number} priceJpy       요금(엔)
 * @property {string} [note]         비고
 */

/**
 * @typedef {Object} ReservationFee  예약 수수료(예약금)
 * @property {string} label  예: '일반 예약'
 * @property {number} krw    금액(원)
 * @property {string} desc   설명
 */

/**
 * @typedef {Object} FaqItem
 * @property {string} q
 * @property {string} a
 */

/**
 * @typedef {Object} ReservationStep
 * @property {string} title
 * @property {string} body
 * @property {string[]} [points]
 */

/**
 * @typedef {Object} Product
 * @property {string} slug          URL 식별자, 예: 'summer-lavender-taxi'
 * @property {string} name          상품명
 * @property {string} summary       한 줄 요약 (목록/메타에 사용)
 * @property {string} season        PRODUCT_SEASON 값
 * @property {string} status        PRODUCT_STATUS 값
 * @property {number} sortOrder     목록 정렬 순서 (작을수록 먼저)
 * @property {string|null} badge    특가/한정 등 배지 텍스트 (없으면 null)
 * @property {string} heroImage     대표 이미지 경로
 * @property {string} heroImageAlt  대표 이미지 대체 텍스트
 * @property {string} durationLabel 소요시간 표기, 예: '3~6시간'
 * @property {string[]} highlights  핵심 특징 목록
 * @property {string[]} courseSpots 추천 코스 후보 관광지
 * @property {VehicleTier[]} [vehicleTiers]  시간당 요금표 (시간당 과금 상품)
 * @property {CharterTier[]} [charterPricing]  전세 정액 요금표 (패키지 상품)
 * @property {string} [jumboNote]   점보 택시 등 추가 차량 안내
 * @property {ReservationFee[]} reservationFees  예약 수수료 목록
 * @property {ReservationStep[]} reservationSteps  예약 진행 단계
 * @property {string[]} routeRules  출발/도착지 규정 안내
 * @property {string[]} policies    변경/취소/환불/노쇼 규정
 * @property {FaqItem[]} faq        자주 묻는 질문
 * @property {{title: string, body: string}|null} reviewEvent  리뷰 이벤트(없으면 null)
 * @property {{kakaoUrl: string, bookingHref: string, courseId: string|null}} cta  예약/문의 진입
 */

// 요금은 vehicleTiers(시간당) 또는 charterPricing(전세) 중 최소 하나 필요 — 별도 검증.
const REQUIRED_FIELDS = ['slug', 'name', 'summary', 'heroImage']

const DEFAULTS = {
  season: PRODUCT_SEASON.ALL_SEASON,
  status: PRODUCT_STATUS.DRAFT,
  sortOrder: 100,
  badge: null,
  heroImageAlt: '',
  durationLabel: '협의',
  highlights: [],
  courseSpots: [],
  vehicleTiers: [],
  charterPricing: [],
  jumboNote: '',
  reservationFees: [],
  reservationSteps: [],
  routeRules: [],
  policies: [],
  faq: [],
  reviewEvent: null,
  cta: { kakaoUrl: '', bookingHref: '/booking?from=product', courseId: null },
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 상품 데이터를 검증하고 기본값을 채워 정규화된 Product 를 반환한다.
 * 운영 안전장치: 필수 필드 누락/형식 오류 시 빌드/로드 시점에 즉시 throw.
 * @param {Partial<Product>} input
 * @returns {Product}
 */
export function defineProduct(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('[products] defineProduct: 객체를 전달해야 합니다.')
  }

  for (const field of REQUIRED_FIELDS) {
    const value = input[field]
    const isEmptyArray = Array.isArray(value) && value.length === 0
    if (value === undefined || value === null || value === '' || isEmptyArray) {
      throw new Error(`[products] "${input.slug || '(slug 미지정)'}" 상품에 필수 필드 누락: ${field}`)
    }
  }

  if (!SLUG_PATTERN.test(input.slug)) {
    throw new Error(`[products] slug 형식 오류: "${input.slug}" (소문자/숫자/하이픈만 허용)`)
  }

  const hasHourly = Array.isArray(input.vehicleTiers) && input.vehicleTiers.length > 0
  const hasCharter = Array.isArray(input.charterPricing) && input.charterPricing.length > 0
  if (!hasHourly && !hasCharter) {
    throw new Error(`[products] "${input.slug}" 요금 누락: vehicleTiers(시간당) 또는 charterPricing(전세) 중 하나는 필요합니다.`)
  }

  const status = input.status ?? DEFAULTS.status
  if (!Object.values(PRODUCT_STATUS).includes(status)) {
    throw new Error(`[products] "${input.slug}" status 값 오류: ${status}`)
  }

  const season = input.season ?? DEFAULTS.season
  if (!Object.values(PRODUCT_SEASON).includes(season)) {
    throw new Error(`[products] "${input.slug}" season 값 오류: ${season}`)
  }

  return {
    ...DEFAULTS,
    ...input,
    status,
    season,
    cta: { ...DEFAULTS.cta, ...(input.cta || {}) },
  }
}

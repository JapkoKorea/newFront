// 겨울 택시투어 — 11~3월 설경 시즌 상품.
//
// 코스 목록은 src/data/tourCourses.js 에서 winter 시즌 코스를 가져온다.
// 코스를 추가하려면 그 파일에 넣고 season 에 'winter' 를 포함시키면 된다.

import { defineProduct, PRODUCT_SEASON, PRODUCT_STATUS } from '../schema.js'
import {
  VEHICLE_TIERS,
  RESERVATION_FEES,
  RESERVATION_STEPS,
  ROUTE_RULES,
  POLICIES,
  FAQ,
  REVIEW_EVENT,
  KAKAO_URL,
} from '../common.js'

export default defineProduct({
  slug: 'winter-taxi-tour',
  name: '겨울 택시투어',
  summary: '눈 덮인 비에이의 설경과 빙결 폭포를 전세 택시로 둘러보는 겨울 시즌 투어.',
  season: PRODUCT_SEASON.WINTER,
  status: PRODUCT_STATUS.PUBLISHED,
  sortOrder: 10,
  badge: '겨울 시즌',
  heroImage: '/assets/winter-snow.webp',
  heroImageAlt: '눈 덮인 비에이 언덕에 홀로 선 크리스마스 나무',
  durationLabel: '3~6시간',

  highlights: [
    '겨울에만 볼 수 있는 설원 풍경과 빙결 흰수염폭포를 둘러봅니다.',
    '적설기에는 사륜구동 차량으로 배차되어 눈길 이동이 안전합니다.',
    '코스는 예약 후 결정하거나 현지에서 기사님께 전달해도 됩니다.',
  ],

  // 이 상품에서 고를 수 있는 코스 (tourCourses.js 의 id).
  courseIds: ['snow-drive', 'winter-falls', 'standard', 'nature', 'photo', 'family'],

  courseSpots: [
    '크리스마스 나무',
    '켄과 메리 나무',
    '마일드세븐 언덕',
    '청의 호수',
    '흰수염폭포',
    '세븐스타 나무',
  ],

  vehicleTiers: VEHICLE_TIERS,
  reservationFees: RESERVATION_FEES,
  reservationSteps: RESERVATION_STEPS,
  routeRules: ROUTE_RULES,
  policies: POLICIES,
  faq: FAQ,
  reviewEvent: REVIEW_EVENT,

  cta: {
    kakaoUrl: KAKAO_URL,
    bookingHref: '/booking?from=product',
    courseId: 'snow-drive',
  },
})

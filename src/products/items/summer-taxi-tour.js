// 여름 택시투어 — 6~9월 라벤더·꽃 시즌 상품.
//
// 코스 목록은 src/data/tourCourses.js 에서 summer 시즌 코스를 가져온다.

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
  slug: 'summer-taxi-tour',
  name: '여름 택시투어',
  summary: '라벤더가 만개하는 비에이·후라노의 여름 풍경을 전세 택시로 둘러보는 시즌 투어.',
  season: PRODUCT_SEASON.SUMMER,
  status: PRODUCT_STATUS.PUBLISHED,
  sortOrder: 20,
  badge: '여름 시즌',
  // TODO: 여름 대표 사진(라벤더 밭 등)이 준비되면 채운다.
  // 저장소에 있는 사진은 전부 설경이라, 잘못된 계절 사진을 쓰는 대신 비워 둔다.
  heroImage: null,
  heroImageAlt: '여름 비에이의 라벤더 밭과 언덕',
  durationLabel: '3~6시간',

  highlights: [
    '라벤더 절정기(7~8월) 팜 토미타와 사계채언덕을 함께 둘러봅니다.',
    '현지에서 코스 변경이 가능하고, 시간이 부족하면 1시간 단위로 추가할 수 있습니다.',
    '코스는 예약 후 결정하거나 현지에서 기사님께 전달해도 됩니다.',
  ],

  // 이 상품에서 고를 수 있는 코스 (tourCourses.js 의 id).
  courseIds: ['lavender-road', 'flower-hill', 'extended', 'standard', 'nature', 'photo', 'family'],

  courseSpots: [
    '팜 토미타',
    '사계채언덕 (四季彩の丘)',
    '패치워크의 길',
    '마일드세븐 언덕',
    '켄과 메리 나무',
    '세븐스타 나무',
    '흰수염폭포',
    '닝구르 테라스',
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
    courseId: 'lavender-road',
  },
})

// 장소 이름/좌표/교통권 판정 공용 유틸.
//
// 이전에는 MapContainer 와 TourRouteEditor 가 같은 로직을 각자 들고 있었고,
// 특히 교통권 경계가 서로 달라 같은 장소를 한쪽은 허용하고 한쪽은 거부했다.
// (MapContainer 의 south=43.35 기준으로는 후라노역과 닝구르 테라스가 거부됐다)
// 판정 기준은 이 파일 하나로 유지한다.

import { COORDS_DICT } from '@/lib/spotCoords.js'

// useLoadScript 는 배열 참조가 바뀌면 로더를 재초기화한다. 반드시 상수로 쓴다.
export const MAPS_LIBRARIES = ['places']

export const CENTER_BIEI = { lat: 43.5913, lng: 142.4622 }

// 교통권(배차 가능 범위). 후라노 지역(위도 43.32 부근)까지 포함한다.
export const ALLOWED_BOUNDS = {
  south: 43.32,
  north: 43.78,
  west: 142.35,
  east: 142.65,
}

export const STATION_CHIPS = ['아사히카와역', '비에이역', '지요가오카역', '후라노역']

export const WAYPOINT_SUGGESTIONS = Object.keys(COORDS_DICT).filter(
  (name) => !STATION_CHIPS.includes(name),
)

export const ALLOWED_PLACE_NAMES = Array.from(new Set([...STATION_CHIPS, ...WAYPOINT_SUGGESTIONS]))

const SEARCH_ALIASES = {
  '아사히카와역': ['아사히카와', 'asahikawa', 'asahikawa station', '旭川'],
  '비에이역': ['비에이', 'biei', 'biei station', '美瑛'],
  '지요가오카역': ['지요가오카', 'chiyogaoka', 'chiyogaoka station'],
  '후라노역': ['후라노', 'furano', 'furano station', '富良野'],
  '아사히카와 공항': ['아사히카와공항', 'asahikawa airport', 'airport'],
  '청의 호수': ['청의호수', 'blue pond', 'aoiike'],
  '흰수염폭포': ['흰수염', 'shirahige', 'shirahige falls'],
  '팜 토미타': ['토미타', 'farm tomita', 'tomita'],
  '닝구르 테라스': ['닝구르', 'ningle terrace', 'ningle'],
}

const PLACE_ALIASES = {
  '팜 토미타 (계절 따라 선택)': '팜 토미타',
  '비에이역 또는 후라노역': '비에이역',
}

export const BIEI_PAIR_ALERT_MESSAGE =
  '교통권 문제로 인해 아사히카와 지역이 출발지 또는 도착지에 포함되어야 합니다.\n비에이역에서 2 전역인 지요가오카역에서 출발 또는 도착하실 수 있습니다.'

export const OUT_OF_REGION_MESSAGE = '교통권 밖이므로 상담을 통해 예약해주세요'

/** 괄호 주석을 제거한 장소 이름. 예: "팜 토미타 (계절 따라 선택)" -> "팜 토미타" */
export function normalizePlaceName(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s*\([^)]*\)\s*/g, '').trim()
}

/** 검색 비교용으로 공백과 대소문자를 없앤 형태. */
export function normalizeSearchTerm(value) {
  return normalizePlaceName(value).toLowerCase().replace(/\s+/g, '')
}

/** 한 장소가 매칭될 수 있는 검색어 후보 목록(별칭 포함). */
export function getSearchCandidates(name) {
  const normalized = normalizePlaceName(name)
  const compact = normalizeSearchTerm(name)
  const aliases = SEARCH_ALIASES[normalized] || SEARCH_ALIASES[name] || []
  return [name, normalized, compact, ...aliases].map((item) => normalizeSearchTerm(item)).filter(Boolean)
}

/** 장소 이름으로 좌표를 찾는다. 사전에 없으면 null. */
export function resolveCoord(name) {
  const normalized = normalizePlaceName(name)
  const alias = PLACE_ALIASES[name] || PLACE_ALIASES[normalized] || normalized
  return COORDS_DICT[alias] || null
}

/** 교통권 안쪽인지 판정한다. */
export function isInAllowedRegion(lat, lng) {
  return (
    lat >= ALLOWED_BOUNDS.south &&
    lat <= ALLOWED_BOUNDS.north &&
    lng >= ALLOWED_BOUNDS.west &&
    lng <= ALLOWED_BOUNDS.east
  )
}

/** 출발지와 도착지가 모두 비에이역이면 배차가 불가능하다. */
export function shouldBlockBieiPair(departureName, destinationName) {
  return normalizePlaceName(departureName) === '비에이역'
    && normalizePlaceName(destinationName) === '비에이역'
}

/** 구글 자동완성 결과에서 표시용 이름을 뽑는다. */
export function extractPredictionLabel(prediction) {
  return prediction?.structured_formatting?.main_text || prediction?.description || ''
}

/** 이름으로 place 객체({ name, coord })를 만든다. */
export function makePlace(name) {
  return { name: name || '', coord: resolveCoord(name) }
}

/** 두 좌표가 사실상 같은 지점인지. */
export function isSameCoord(a, b) {
  if (!a || !b) return false
  return Math.abs(a.lat - b.lat) <= 0.00015 && Math.abs(a.lng - b.lng) <= 0.00015
}

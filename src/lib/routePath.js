'use client'

// 경로 계산을 한 곳에 모은다.
//
// DirectionsService / DirectionsRenderer 는 2026-02-25 자로 deprecated 다.
// 대신 routes 라이브러리의 Route.computeRoutes 를 쓴다. 결과 Route 객체가
// createPolylines() 로 google.maps.Polyline 을 만들어 주므로, 선을 직접
// 그리고 지우면 된다(별도 렌더러가 필요 없다).
//
// routes 라이브러리는 로더의 libraries 목록에 없어도 importLibrary 로
// 필요할 때 받아 온다.

const ROUTE_STROKE = {
  strokeColor: '#f59e0b',
  strokeWeight: 4,
  strokeOpacity: 0.85,
}

/**
 * 경로를 계산한다.
 *
 * @param {{lat: number, lng: number}} origin
 * @param {{lat: number, lng: number}} destination
 * @param {{lat: number, lng: number}[]} intermediates 경유지(순서 유지)
 * @returns {Promise<object|null>} Route 객체. 경로가 없으면 null
 */
export async function computeRoute(origin, destination, intermediates = []) {
  if (!origin || !destination || typeof window === 'undefined') return null
  if (!window.google?.maps?.importLibrary) return null

  const { Route } = await window.google.maps.importLibrary('routes')
  const { routes } = await Route.computeRoutes({
    origin,
    destination,
    intermediates,
    travelMode: 'DRIVING',
    // 요청한 필드만 청구된다. 선을 그리는 데 필요한 것만 받는다.
    fields: ['path', 'distanceMeters', 'durationMillis'],
  })
  return routes?.[0] || null
}

/**
 * Route 를 지도 위에 선으로 그린다.
 *
 * @returns {google.maps.Polyline[]} 나중에 지울 수 있도록 돌려준다
 */
export function drawRoute(route, map, options = {}) {
  if (!route || !map) return []
  const polylines = route.createPolylines()
  for (const line of polylines) {
    line.setOptions({ ...ROUTE_STROKE, ...options })
    line.setMap(map)
  }
  return polylines
}

/** drawRoute 로 그린 선을 지운다. */
export function clearRoute(polylines) {
  for (const line of polylines || []) {
    line.setMap(null)
  }
}

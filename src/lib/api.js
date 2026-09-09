// 백엔드는 backend/main.py 기준 5000 에서 돈다. 배포에서는 NEXT_PUBLIC_API_BASE_URL 로 덮는다.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

/** 로그인이 풀렸을 때 던지는 오류. 화면이 이걸 보고 안내를 띄운다. */
export class AuthExpiredError extends Error {
  constructor(message) {
    super(message || '로그인이 만료되었습니다. 다시 로그인해 주세요.')
    this.name = 'AuthExpiredError'
  }
}

/**
 * 응답이 401 이면 AuthExpiredError 를 던진다.
 *
 * 만료와 토큰 오류를 서버가 구분해 주므로(dependencies/auth.py) 문구를 그대로
 * 쓴다. 401 이 아니면 아무것도 하지 않는다.
 */
export async function throwIfUnauthorized(response) {
  if (response.status !== 401) return
  let detail = ''
  try {
    const body = await response.clone().json()
    detail = body?.detail || ''
  } catch {
    detail = ''
  }
  throw new AuthExpiredError(detail)
}

export function getJwtToken() {
  return localStorage.getItem('jwt') || ''
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = getJwtToken()
  if (!token) {
    return { ...extraHeaders }
  }
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  }
}

// 코스 조회 (서버 컴포넌트에서 호출 가능, 비로그인 허용). 항상 최신 DB 반영.
export async function fetchCourses(season) {
  const url = new URL(`${API_BASE_URL}/api/courses`)
  if (season) url.searchParams.set('season', season)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch courses: ${res.status}`)
  const data = await res.json()
  return data.courses || []
}

export async function fetchCourse(id) {
  const res = await fetch(`${API_BASE_URL}/api/courses/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch course: ${res.status}`)
  return res.json()
}

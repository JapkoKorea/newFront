import { API_BASE_URL } from '@/lib/apiBase.js'
import { clearSession, ensureAccessToken, forceRefresh } from '@/lib/session.js'

export { API_BASE_URL }

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
 *
 * apiFetch 를 쓰면 갱신 재시도까지 끝난 뒤의 401 만 남으므로, 이 함수는 그
 * 결과를 오류로 바꾸는 마지막 단계다.
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

function withAuthHeader(headers, token) {
  if (!token) return headers
  return { ...headers, Authorization: `Bearer ${token}` }
}

/**
 * 인증이 붙는 API 호출.
 *
 * 액세스 토큰이 30분짜리라 요청 도중에 만료되는 일이 정상적으로 일어난다.
 * 그때마다 사용자를 로그인 화면으로 보내면 안 되므로 여기서 조용히 처리한다.
 *
 *   1. 보내기 전에 토큰을 확보한다(없거나 곧 만료면 리프레시 쿠키로 갱신).
 *   2. 그래도 401 이 오면 한 번 더 갱신하고 같은 요청을 재시도한다.
 *   3. 재시도까지 401 이면 진짜 로그인이 풀린 것이다. 로컬 세션을 비운다.
 *
 * 재시도는 정확히 한 번만 한다. 서버가 계속 401 을 주는 상황에서 무한히
 * 돌지 않게 한다.
 *
 * body 가 FormData 나 스트림이면 재시도에서 다시 읽을 수 없다. 그런 요청은
 * retry:false 로 부르거나, 호출부가 body 를 새로 만들어 다시 부르면 된다.
 * 지금 쓰이는 곳은 전부 JSON 문자열이라 문제되지 않는다.
 */
export async function apiFetch(path, options = {}) {
  const { auth = true, headers = {}, ...init } = options
  const url = new URL(path, API_BASE_URL)

  if (!auth) {
    return fetch(url, { ...init, headers })
  }

  // 토큰은 우리 API 로만 나간다. 호출부가 실수로(또는 외부에서 온 값으로)
  // 절대 주소를 넘기면 Bearer 헤더가 남의 서버로 갈 수 있다.
  if (url.origin !== new URL(API_BASE_URL).origin) {
    throw new Error(`apiFetch: ${url.origin} 으로는 인증 정보를 보내지 않습니다`)
  }

  const token = await ensureAccessToken()
  let response = await fetch(url, { ...init, headers: withAuthHeader(headers, token) })

  if (response.status !== 401) return response

  const renewed = await forceRefresh()
  if (!renewed) {
    // 갱신조차 안 됐다. 리프레시 쿠키가 없거나 만료됐다는 뜻이다.
    clearSession()
    return response
  }

  response = await fetch(url, { ...init, headers: withAuthHeader(headers, renewed) })
  if (response.status === 401) clearSession()
  return response
}

/** JSON 본문을 보내는 인증 요청. Content-Type 을 빼먹는 실수를 줄인다. */
export function apiFetchJson(path, { body, ...options } = {}) {
  return apiFetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
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

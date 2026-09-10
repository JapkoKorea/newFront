/**
 * 로그인 세션 판정.
 *
 * 전에는 화면들이 localStorage 에 'jwt' 가 "있는지"만 보고 로그인 상태를
 * 정했다. 그래서 만료된 토큰이 남아 있으면 내비에는 계속 로그인으로 보이고,
 * 정작 인증이 필요한 API 를 부르는 순간(예: 결제) 401 이 났다. 예약을 다
 * 채우고 결제 단계에서야 튕기는 것이 그 때문이다.
 *
 * 여기서 exp 를 직접 확인해 만료된 토큰은 없는 것으로 취급하고 지운다.
 * 아직 리프레시 토큰이 없으므로 만료되면 재로그인이 답이다. 적어도 화면이
 * 사실과 다른 상태를 보여주지는 않게 한다.
 */

const JWT_KEY = 'jwt'
const USER_KEY = 'user'

/** 통신 지연과 시계 오차를 감안한 여유. 이 안에 만료될 토큰은 이미 만료로 본다. */
const EXPIRY_SKEW_SECONDS = 30

/** JWT 페이로드를 꺼낸다. 서명은 검증하지 않는다 — 그건 서버 몫이다. */
function decodePayload(token) {
  const part = String(token || '').split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    // atob 은 라틴1 만 다루므로 UTF-8 로 되돌린다. 닉네임에 한글이 들어갈 수 있다.
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * 만료됐는지.
 *
 * 모양이 깨진 토큰도 만료로 본다. 서버가 어차피 거절할 것을 들고 있어 봐야
 * 로그인된 것처럼 보이기만 한다.
 *
 * exp 가 아예 없는 토큰은 만료로 보지 않는다. 만료 없는 토큰을 발급하도록
 * 바뀌더라도 로그인이 통째로 막히지는 않게 한다.
 */
export function isTokenExpired(token) {
  const payload = decodePayload(token)
  if (!payload) return true
  if (typeof payload.exp !== 'number') return false
  return payload.exp <= Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS
}

export function clearSession() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(JWT_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // 저장소를 못 건드려도 화면은 로그아웃으로 그린다.
  }
}

/**
 * 쓸 수 있는 토큰만 돌려준다. 만료됐으면 지우고 빈 문자열.
 *
 * SSR 에서는 항상 빈 문자열이다. 호출부는 useEffect 안에서 쓰거나
 * ssr:false 페이지에서 써야 한다.
 */
export function getValidToken() {
  if (typeof window === 'undefined') return ''
  let token = ''
  try {
    token = localStorage.getItem(JWT_KEY) || ''
  } catch {
    return ''
  }
  if (!token) return ''
  if (isTokenExpired(token)) {
    clearSession()
    return ''
  }
  return token
}

/** 로그인 상태와 표시할 이름. 만료된 세션은 정리하고 로그아웃으로 돌려준다. */
export function readSession() {
  const token = getValidToken()
  if (!token) return { isLoggedIn: false, nickname: '', user: null }

  let user = null
  try {
    const raw = localStorage.getItem(USER_KEY)
    user = raw ? JSON.parse(raw) : null
  } catch {
    user = null
  }
  if (!user) {
    clearSession()
    return { isLoggedIn: false, nickname: '', user: null }
  }

  return {
    isLoggedIn: true,
    nickname: user.nickname || user.userName || '',
    user,
  }
}

/** 토큰이 남은 시간(초). 없거나 만료면 0. 만료 임박 안내에 쓸 수 있다. */
export function secondsUntilExpiry() {
  const token = typeof window === 'undefined' ? '' : localStorage.getItem(JWT_KEY) || ''
  const payload = decodePayload(token)
  if (!payload || typeof payload.exp !== 'number') return 0
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
}

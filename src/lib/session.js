/**
 * 로그인 세션.
 *
 * 액세스 토큰은 이 모듈의 메모리에만 둔다. localStorage 에 두면 XSS 로 들어온
 * 스크립트가 그대로 읽어 갈 수 있고, 지워도 탭마다 남는 사본을 챙기기 어렵다.
 * 대신 수명이 30분으로 짧고, 새로고침하면 사라진다.
 *
 * 세션을 이어 주는 것은 리프레시 토큰이고, 그건 httpOnly 쿠키라 JS 가 볼 수
 * 없다. 그래서 "로그인 상태"의 진짜 근거는 이 파일이 아니라 서버다. 화면은
 * bootstrapSession() 이 한 번 돌기를 기다렸다가 확정된 상태를 본다.
 *
 * localStorage 에는 표시용 사용자 정보(user)만 남긴다. 이게 없으면 새로고침
 * 직후 갱신이 끝날 때까지 내비가 로그아웃으로 깜빡인다. 이 값은 힌트일 뿐이고,
 * 갱신 결과와 어긋나면 갱신 결과를 따른다.
 */

import { API_BASE_URL } from '@/lib/apiBase.js'

const USER_HINT_KEY = 'user'
/** 토큰을 localStorage 에 두던 시절의 키. 남아 있으면 지운다. */
const LEGACY_TOKEN_KEY = 'jwt'

/** 통신 지연과 시계 오차를 감안한 여유. 이 안에 만료될 토큰은 이미 만료로 본다. */
const EXPIRY_SKEW_SECONDS = 30

let accessToken = ''
/** 액세스 토큰 만료 시각(초, epoch). */
let accessExpiresAt = 0
let cachedUser = null
let hintLoaded = false
/** bootstrapSession() 이 한 번이라도 끝났는지. 화면이 깜빡임을 피하는 데 쓴다. */
let settled = false
/** 진행 중인 갱신 요청. 동시에 여러 번 부르지 않도록 공유한다. */
let refreshInFlight = null

const listeners = new Set()

function notify() {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // 구독자 하나가 터져도 나머지는 알린다.
    }
  }
}

/** 로그인 상태가 바뀔 때 호출된다. 해제 함수를 돌려준다. */
export function subscribeSession(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function readHint() {
  if (hintLoaded) return cachedUser
  hintLoaded = true
  if (typeof window === 'undefined') return null
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    const raw = localStorage.getItem(USER_HINT_KEY)
    cachedUser = raw ? JSON.parse(raw) : null
  } catch {
    cachedUser = null
  }
  return cachedUser
}

function writeHint(user) {
  // 표시에 쓰는 것만 남긴다. 로그인 응답의 user 는 토큰 claims 라 카카오 ID·
  // 이메일·만료시각까지 들어 있는데, 그걸 그대로 저장하면 프런트 XSS 한 번에
  // 개인정보가 통째로 새어 나간다.
  const nickname = user ? user.nickname || user.userName || '' : ''
  user = user ? { nickname } : null
  cachedUser = user
  hintLoaded = true
  if (typeof window === 'undefined') return
  try {
    if (user) localStorage.setItem(USER_HINT_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_HINT_KEY)
  } catch {
    // 저장소를 못 써도 메모리 상태로 동작한다.
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

/** 메모리에 쓸 만한 액세스 토큰이 있는지. */
function hasFreshToken() {
  return Boolean(accessToken) && accessExpiresAt > nowSeconds() + EXPIRY_SKEW_SECONDS
}

/** 로그인/갱신 응답을 받아 세션을 세운다. */
export function setSession({ token, user, expiresIn }) {
  accessToken = token || ''
  accessExpiresAt = token ? nowSeconds() + (Number(expiresIn) || 0) : 0
  if (token && !expiresIn) {
    // 서버가 남은 초를 안 줬으면 토큰의 exp 를 본다.
    accessExpiresAt = decodeExp(token) || 0
  }
  writeHint(user || null)
  settled = true
  notify()
}

function decodeExp(token) {
  const part = String(token || '').split('.')[1]
  if (!part) return 0
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return 0
  }
}

/** 메모리와 힌트를 모두 비운다. 서버 세션은 건드리지 않는다. */
function forgetLocal() {
  accessToken = ''
  accessExpiresAt = 0
  writeHint(null)
  settled = true
  notify()
}

/**
 * 로그아웃. 서버의 리프레시 세션도 끊는다.
 *
 * 서버 호출이 실패해도 로컬은 반드시 비운다. 사용자에게는 로그아웃이
 * 됐는지가 중요하지, 왜 실패했는지는 할 수 있는 일이 없다.
 */
export async function signOut() {
  forgetLocal()
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // 무시한다. 쿠키는 만료되면 사라지고, 서버 세션도 결국 만료된다.
  }
}

/** 서버에 묻지 않고 로컬만 비운다. 갱신이 401 로 끝났을 때처럼 이미 끊긴 경우. */
export function clearSession() {
  forgetLocal()
}

/**
 * 리프레시 쿠키로 새 액세스 토큰을 받는다.
 *
 * 여러 요청이 동시에 만료를 마주쳐도 갱신은 한 번만 나간다. 두 번 나가면
 * 서버가 회전을 두 번 하게 되고, 늦게 도착한 쪽이 이미 쓰인 토큰을 들고 와
 * 재사용으로 오해받는다.
 */
function requestRefresh() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        forgetLocal()
        return ''
      }
      const data = await response.json()
      const token = data?.token || ''
      if (!token) {
        forgetLocal()
        return ''
      }
      setSession({ token, user: data.user || null, expiresIn: data.expires_in })
      return token
    } catch {
      // 네트워크 오류는 로그아웃이 아니다. 힌트를 지우면 잠깐 끊긴 것뿐인데
      // 로그인 화면으로 쫓아내게 된다. 토큰만 비우고 다음 시도에 맡긴다.
      accessToken = ''
      accessExpiresAt = 0
      settled = true
      notify()
      return ''
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/**
 * 쓸 수 있는 액세스 토큰을 돌려준다. 없으면 갱신을 시도한다.
 *
 * 로그인하지 않은 방문자도 첫 호출에서 갱신을 한 번 시도한다(서버가 401 로
 * 답한다). 쿠키는 JS 가 볼 수 없으므로 물어보기 전에는 알 수 없다.
 */
export async function ensureAccessToken() {
  if (typeof window === 'undefined') return ''
  if (hasFreshToken()) return accessToken
  return requestRefresh()
}

/** 갱신을 강제한다. 401 을 받은 요청이 재시도 전에 부른다. */
export async function forceRefresh() {
  if (typeof window === 'undefined') return ''
  accessToken = ''
  accessExpiresAt = 0
  return requestRefresh()
}

/** 앱 시작 때 한 번. 새로고침으로 사라진 메모리 토큰을 쿠키로 복구한다. */
export async function bootstrapSession() {
  readHint()
  await ensureAccessToken()
  settled = true
  notify()
}

/**
 * 현재 로그인 상태. 동기 함수라 렌더 중에 바로 쓸 수 있다.
 *
 * settled 가 false 인 동안의 값은 localStorage 힌트에 기댄 추측이다. 화면을
 * 그리기에는 충분하지만(깜빡임 방지), 인증이 필요한 동작을 막거나 허용하는
 * 근거로 쓰면 안 된다. 그건 ensureAccessToken() 결과로 판단한다.
 */
export function readSession() {
  const user = readHint()
  const loggedIn = Boolean(accessToken) || Boolean(user)
  return {
    isLoggedIn: loggedIn,
    nickname: user?.nickname || user?.userName || '',
    user: user || null,
    settled,
  }
}

/** 메모리에 든 토큰. 갱신을 유발하지 않는다. 대부분의 호출부는 apiFetch 를 쓴다. */
export function getAccessToken() {
  return hasFreshToken() ? accessToken : ''
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

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

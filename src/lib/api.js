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

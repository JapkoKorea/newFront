// 운영자 API 클라이언트.
//
// 모든 요청은 관리자 토큰이 필요하며, 권한은 서버가 users.role 로 판정한다.
// 화면은 권한을 스스로 판단하지 않고 /api/admin/me 결과만 따른다.

import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/admin${path}`, {
    ...options,
    headers: getAuthHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) }),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.detail || `요청 실패 (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}

/** 관리자 권한 확인. 권한이 없으면 status 403 으로 던진다. */
export const fetchAdminMe = () => request('/me')

export const fetchAdminReservations = (status) =>
  request(`/reservations${status ? `?status=${encodeURIComponent(status)}` : ''}`)

export const updateReservationStatus = (reservationNumber, status, reason) =>
  request(`/reservations/${encodeURIComponent(reservationNumber)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason: reason || null }),
  })

export const fetchChangeRequests = (status) =>
  request(`/change-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`)

export const resolveChangeRequest = (requestId, status, adminNote) =>
  request(`/change-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, admin_note: adminNote || null }),
  })

export const fetchConversations = (unansweredOnly) =>
  request(`/conversations${unansweredOnly ? '?unanswered=true' : ''}`)

export const fetchConversationMessages = (conversationId) =>
  request(`/conversations/${encodeURIComponent(conversationId)}/messages`)

export const replyToConversation = (conversationId, body) =>
  request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })

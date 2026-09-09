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

export const fetchAdminReviews = (status) =>
  request(`/reviews${status ? `?status=${encodeURIComponent(status)}` : ''}`)

/** 후기 노출/숨김. 삭제하지 않고 숨겨서 기록을 남긴다. */
export const setReviewVisibility = (reviewId, status, reason) =>
  request(`/reviews/${reviewId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason: reason || null }),
  })

/**
 * 결제 확인. 통장이나 스토어 주문을 보고 결제 완료로 바꾸거나 되돌린다.
 * confirmReservation 을 주면 예약 확정까지 한 번에 처리한다.
 */
export const setReservationPaymentStatus = (reservationNumber, paymentStatus, confirmReservation = false) =>
  request(`/reservations/${encodeURIComponent(reservationNumber)}/payment`, {
    method: 'PATCH',
    body: JSON.stringify({ payment_status: paymentStatus, confirm_reservation: confirmReservation }),
  })

/** 스마트스토어 주문을 판매자 API 로 대조해 자동 확인한다. */
export const verifyNaverPayment = (reservationNumber) =>
  request(`/reservations/${encodeURIComponent(reservationNumber)}/payment/verify-naver`, {
    method: 'POST',
  })

/** 네이버 커머스 API 연결 상태. 키가 없으면 자동 확인 버튼을 감춘다. */
export const fetchNaverIntegration = () => request('/integrations/naver')

/** 예약 처리 내역. 언제 무엇을 확정·반려했고 사유가 무엇이었는지. */
export const fetchStatusHistory = (reservationNumber) =>
  request(`/reservations/history${reservationNumber ? `?reservation_number=${encodeURIComponent(reservationNumber)}` : ''}`)

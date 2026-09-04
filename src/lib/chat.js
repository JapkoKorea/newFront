// 상담 채팅 API 클라이언트 (로그인 필요). 폴링 기반.
import { API_BASE_URL, getAuthHeaders, getJwtToken } from '@/lib/api.js'

export class ChatAuthError extends Error {}

function authHeadersOrThrow(extra = {}) {
  if (!getJwtToken()) throw new ChatAuthError('로그인이 필요합니다')
  return getAuthHeaders(extra)
}

/** 열린 대화를 가져오거나 생성한다. reservationNumber로 예약 맥락 연결(선택). */
export async function openConversation(reservationNumber = null) {
  const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
    method: 'POST',
    headers: authHeadersOrThrow({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reservation_number: reservationNumber }),
  })
  if (res.status === 401) throw new ChatAuthError('로그인이 필요합니다')
  if (!res.ok) throw new Error(`대화를 열지 못했습니다 (${res.status})`)
  return res.json()
}

/** conversationId의 메시지를 afterId 이후로 조회 (폴링). */
export async function fetchMessages(conversationId, afterId = 0) {
  const url = new URL(`${API_BASE_URL}/api/chat/messages`)
  url.searchParams.set('conversation_id', conversationId)
  url.searchParams.set('after', String(afterId))
  const res = await fetch(url, { headers: authHeadersOrThrow(), cache: 'no-store' })
  if (res.status === 401) throw new ChatAuthError('로그인이 필요합니다')
  if (!res.ok) throw new Error(`메시지를 불러오지 못했습니다 (${res.status})`)
  const data = await res.json()
  return data.messages || []
}

/**
 * 메시지를 전송한다.
 * 서버가 봇의 1차 응답을 함께 만들어 주므로 둘 다 돌려준다.
 * @returns {{ message: object, botMessage: object | null, needsAdmin: boolean }}
 */
export async function sendMessage(conversationId, body) {
  const res = await fetch(`${API_BASE_URL}/api/chat/messages`, {
    method: 'POST',
    headers: authHeadersOrThrow({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ conversation_id: conversationId, body }),
  })
  if (res.status === 401) throw new ChatAuthError('로그인이 필요합니다')
  if (!res.ok) throw new Error(`메시지를 보내지 못했습니다 (${res.status})`)
  const data = await res.json()
  return {
    message: data.message,
    botMessage: data.botMessage || null,
    needsAdmin: Boolean(data.needsAdmin),
  }
}

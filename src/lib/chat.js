// 상담 채팅 API 클라이언트 (로그인 필요). 폴링 기반.
import { apiFetch, apiFetchJson } from '@/lib/api.js'

export class ChatAuthError extends Error {}

/**
 * 로그인 여부를 미리 판정하지 않는다.
 *
 * 액세스 토큰은 메모리에만 있어서 새로고침 직후에는 비어 있다. 그걸 보고
 * 미리 막으면 로그인한 사람도 새로고침만 하면 "로그인이 필요합니다" 를 본다.
 * apiFetch 가 리프레시 쿠키로 토큰을 복구하므로, 그러고도 401 이면 그때
 * 로그인이 필요한 것이다.
 */
function throwIfChatUnauthorized(res) {
  if (res.status === 401) throw new ChatAuthError('로그인이 필요합니다')
}

/** 열린 대화를 가져오거나 생성한다. reservationNumber로 예약 맥락 연결(선택). */
export async function openConversation(reservationNumber = null) {
  const res = await apiFetchJson('/api/chat/conversations', {
    method: 'POST',
    body: { reservation_number: reservationNumber },
  })
  throwIfChatUnauthorized(res)
  if (!res.ok) throw new Error(`대화를 열지 못했습니다 (${res.status})`)
  return res.json()
}

/** conversationId의 메시지를 afterId 이후로 조회 (폴링). */
export async function fetchMessages(conversationId, afterId = 0) {
  const query = new URLSearchParams({
    conversation_id: String(conversationId),
    after: String(afterId),
  })
  const res = await apiFetch(`/api/chat/messages?${query}`, { cache: 'no-store' })
  throwIfChatUnauthorized(res)
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
  const res = await apiFetchJson('/api/chat/messages', {
    method: 'POST',
    body: { conversation_id: conversationId, body },
  })
  throwIfChatUnauthorized(res)
  if (!res.ok) throw new Error(`메시지를 보내지 못했습니다 (${res.status})`)
  const data = await res.json()
  return {
    message: data.message,
    botMessage: data.botMessage || null,
    needsAdmin: Boolean(data.needsAdmin),
  }
}

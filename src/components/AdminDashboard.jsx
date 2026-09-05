'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import {
  fetchAdminMe,
  fetchAdminReservations,
  fetchChangeRequests,
  fetchConversationMessages,
  fetchConversations,
  replyToConversation,
  resolveChangeRequest,
  updateReservationStatus,
} from '@/lib/admin.js'

const TABS = [
  { key: 'reservations', label: '예약' },
  { key: 'changes', label: '변경 요청' },
  { key: 'chats', label: '상담' },
]

const STATUS_LABEL = {
  pending: '접수 완료',
  confirmed: '확정',
  rejected: '반려',
  cancelled: '취소',
  completed: '이용 완료',
}

const STATUS_TONE = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-gray-200 text-gray-700',
  completed: 'bg-blue-100 text-blue-800',
}

function Badge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status] || 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

function Empty({ children }) {
  return <p className="py-12 text-center text-sm text-gray-500">{children}</p>
}

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState(null)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState('reservations')

  const [reservations, setReservations] = useState([])
  const [changes, setChanges] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [reply, setReply] = useState('')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, c, v] = await Promise.all([
        fetchAdminReservations(),
        fetchChangeRequests(),
        fetchConversations(),
      ])
      setReservations(r.reservations || [])
      setChanges(c.requests || [])
      setConversations(v.conversations || [])
    } catch (error) {
      if (error.status === 401 || error.status === 403) setAuthError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAdminMe()
      .then((me) => {
        if (cancelled) return
        setAdmin(me)
        loadAll()
      })
      .catch((error) => {
        if (cancelled) return
        setAuthError(
          error.status === 401
            ? '로그인이 필요합니다.'
            : error.status === 403
              ? '관리자 권한이 필요합니다.'
              : error.message,
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadAll])

  const act = async (key, fn) => {
    setBusy(key)
    try {
      await fn()
      await loadAll()
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy('')
    }
  }

  const openChat = async (conversation) => {
    setActiveChat(conversation)
    setChatMessages([])
    try {
      const data = await fetchConversationMessages(conversation.id)
      setChatMessages(data.messages || [])
    } catch (error) {
      alert(error.message)
    }
  }

  const sendReply = async () => {
    const body = reply.trim()
    if (!body || !activeChat) return
    setBusy('reply')
    try {
      await replyToConversation(activeChat.id, body)
      setReply('')
      const data = await fetchConversationMessages(activeChat.id)
      setChatMessages(data.messages || [])
      const list = await fetchConversations()
      setConversations(list.conversations || [])
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy('')
    }
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 pt-24">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900">운영자 화면</h1>
          <p className="mt-2 text-sm text-gray-600">{authError}</p>
          <Button className="mt-6 bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/login')}>
            로그인
          </Button>
        </div>
      </div>
    )
  }

  const pendingReservations = reservations.filter((r) => r.status === 'pending').length
  const pendingChanges = changes.filter((c) => c.status === 'pending').length
  const unansweredChats = conversations.filter((c) => c.unanswered).length
  const counts = { reservations: pendingReservations, changes: pendingChanges, chats: unansweredChats }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-24 pb-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">운영자</h1>
            <p className="mt-1 text-sm text-gray-600">
              {admin ? `${admin.displayName} (${admin.role})` : ' '}
            </p>
          </div>
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        <div className="mt-6 flex gap-2 border-b border-gray-200">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? 'border-yellow-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {item.label}
              {counts[item.key] > 0 ? (
                <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] text-white">
                  {counts[item.key]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          </div>
        ) : (
          <div className="mt-6">
            {tab === 'reservations' ? (
              reservations.length === 0 ? (
                <Empty>예약이 없습니다.</Empty>
              ) : (
                <div className="space-y-3">
                  {reservations.map((item) => (
                    <div key={item.reservation_number} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge status={item.status} />
                          <span className="font-semibold text-gray-900">{item.english_name}</span>
                          <span className="text-sm text-gray-500">{item.user_display_name}</span>
                          {item.pending_change_requests > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              변경 요청 {item.pending_change_requests}건
                            </span>
                          ) : null}
                        </div>
                        <span className="font-mono text-xs text-gray-400">
                          {item.reservation_number.slice(0, 8)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                        <p>{item.tour_date} {item.tour_start_time} · {item.tour_duration_hours}시간 · {item.number_of_people}명</p>
                        <p className="text-gray-600">{item.departure} → {item.destination}</p>
                        <p className="text-gray-600 sm:col-span-2">{item.desired_course}</p>
                        <p className="text-xs text-gray-500 sm:col-span-2">
                          연락처 {item.contact_number} · 결제 {item.payment_status}
                        </p>
                      </div>

                      {item.status === 'pending' ? (
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={busy === item.reservation_number}
                            onClick={() =>
                              act(item.reservation_number, () =>
                                updateReservationStatus(item.reservation_number, 'confirmed', '배차 확인'),
                              )
                            }
                          >
                            확정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === item.reservation_number}
                            onClick={() => {
                              const reason = window.prompt('반려 사유를 입력해 주세요.', '해당 일자 배차 불가')
                              if (reason === null) return
                              act(item.reservation_number, () =>
                                updateReservationStatus(item.reservation_number, 'rejected', reason),
                              )
                            }}
                          >
                            반려
                          </Button>
                        </div>
                      ) : item.status === 'confirmed' ? (
                        <div className="mt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === item.reservation_number}
                            onClick={() =>
                              act(item.reservation_number, () =>
                                updateReservationStatus(item.reservation_number, 'completed', '투어 종료'),
                              )
                            }
                          >
                            이용 완료 처리
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {tab === 'changes' ? (
              changes.length === 0 ? (
                <Empty>변경 요청이 없습니다.</Empty>
              ) : (
                <div className="space-y-3">
                  {changes.map((item) => (
                    <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge status={item.status === 'pending' ? 'pending' : item.status === 'approved' ? 'confirmed' : 'rejected'} />
                          <span className="font-semibold text-gray-900">{item.english_name}</span>
                          <span className="text-sm text-gray-500">{item.user_display_name}</span>
                        </div>
                        <span className="font-mono text-xs text-gray-400">#{item.id}</span>
                      </div>

                      <p className="mt-3 text-sm text-gray-900">
                        {item.current_tour_date} {item.current_tour_start_time}
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="font-semibold">
                          {item.requested_tour_date || item.current_tour_date}{' '}
                          {item.requested_tour_start_time || item.current_tour_start_time}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        사유: {item.reason || '(없음)'}
                      </p>

                      {item.status === 'pending' ? (
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={busy === `cr-${item.id}`}
                            onClick={() =>
                              act(`cr-${item.id}`, () => resolveChangeRequest(item.id, 'approved', '배차 확인'))
                            }
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === `cr-${item.id}`}
                            onClick={() => {
                              const note = window.prompt('거절 사유를 입력해 주세요.', '해당 일자 배차 불가')
                              if (note === null) return
                              act(`cr-${item.id}`, () => resolveChangeRequest(item.id, 'rejected', note))
                            }}
                          >
                            거절
                          </Button>
                        </div>
                      ) : item.admin_note ? (
                        <p className="mt-3 text-xs text-gray-500">처리 메모: {item.admin_note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {tab === 'chats' ? (
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="space-y-2 lg:col-span-2">
                  {conversations.length === 0 ? (
                    <Empty>상담이 없습니다.</Empty>
                  ) : (
                    conversations.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openChat(item)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          activeChat?.id === item.id
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-gray-200 bg-white hover:border-yellow-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">{item.userDisplayName}</span>
                          {item.unanswered ? (
                            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] text-white">
                              답변 필요
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-600">{item.lastBody}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {item.messageCount}개 · 마지막 {item.lastSender}
                          {item.reservationNumber ? ` · 예약 ${item.reservationNumber.slice(0, 8)}` : ''}
                        </p>
                      </button>
                    ))
                  )}
                </div>

                <div className="lg:col-span-3">
                  {activeChat ? (
                    <div className="flex h-[520px] flex-col rounded-xl border border-gray-200 bg-white">
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {chatMessages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                                msg.sender === 'admin'
                                  ? 'bg-yellow-500 text-white'
                                  : msg.sender === 'bot'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-blue-50 text-gray-900'
                              }`}
                            >
                              <p className="mb-1 text-[11px] opacity-70">
                                {msg.sender === 'admin' ? '나' : msg.sender === 'bot' ? '자동 안내' : '고객'}
                              </p>
                              <p className="whitespace-pre-wrap">{msg.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 border-t p-3">
                        <input
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault()
                              sendReply()
                            }
                          }}
                          placeholder="답변을 입력하세요"
                          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                        <Button
                          className="bg-yellow-500 hover:bg-yellow-600"
                          onClick={sendReply}
                          disabled={!reply.trim() || busy === 'reply'}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Empty>왼쪽에서 대화를 선택하세요.</Empty>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

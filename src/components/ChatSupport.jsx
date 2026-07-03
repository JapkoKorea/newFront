'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Send, X, MessageCircle, User, Headset, LogIn } from 'lucide-react'
import { getJwtToken } from '@/lib/api.js'
import { openConversation, fetchMessages, sendMessage, ChatAuthError } from '@/lib/chat.js'

const POLL_INTERVAL_MS = 4000

// 상담원 안내(로컬 인트로 — 서버 저장 안 함).
const GREETING = '안녕하세요, 잽코 택시투어 상담입니다. 예약, 코스, 요금 등 무엇이든 문의해 주세요. 순차적으로 답변드립니다.'

const QUICK_REPLIES = ['예약 문의', '요금 문의', '코스 추천', '취소/변경', '공항 픽업']

const ChatSupport = ({ isOpen, onClose, reservationNumber = null }) => {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const lastIdRef = useRef(0)
  const pollRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => { scrollToBottom() }, [messages])

  const mergeMessages = useCallback((incoming) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      const fresh = incoming.filter((m) => !seen.has(m.id))
      if (!fresh.length) return prev
      return [...prev, ...fresh]
    })
    lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id))
  }, [])

  const poll = useCallback(async () => {
    if (!conversationId) return
    try {
      const newMessages = await fetchMessages(conversationId, lastIdRef.current)
      mergeMessages(newMessages)
    } catch (err) {
      if (err instanceof ChatAuthError) setIsLoggedIn(false)
    }
  }, [conversationId, mergeMessages])

  // 열릴 때: 로그인 확인 -> 대화 오픈 -> 초기 메시지 로드
  useEffect(() => {
    if (!isOpen) return
    const loggedIn = Boolean(getJwtToken())
    setIsLoggedIn(loggedIn)
    if (!loggedIn) return

    let cancelled = false
    setError('')
    ;(async () => {
      try {
        const conversation = await openConversation(reservationNumber)
        if (cancelled) return
        setConversationId(conversation.id)
        const initial = await fetchMessages(conversation.id, 0)
        if (cancelled) return
        mergeMessages(initial)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ChatAuthError) setIsLoggedIn(false)
        else setError('상담 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, reservationNumber, mergeMessages])

  // 폴링
  useEffect(() => {
    if (!isOpen || !conversationId) return
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [isOpen, conversationId, poll])

  const handleSend = async (text = inputMessage) => {
    const body = text.trim()
    if (!body || sending || !conversationId) return
    setSending(true)
    setError('')
    setInputMessage('')
    try {
      const saved = await sendMessage(conversationId, body)
      mergeMessages([saved])
    } catch (err) {
      if (err instanceof ChatAuthError) setIsLoggedIn(false)
      else setError('메시지를 보내지 못했습니다.')
      setInputMessage(body)
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (value) => {
    const date = value ? new Date(value) : new Date()
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full h-[600px] flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b bg-green-500 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5" />
            <div>
              <h3 className="font-semibold">채팅 상담</h3>
              <p className="text-xs opacity-90">문의를 남기시면 순차적으로 답변드립니다</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-green-600">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {!isLoggedIn ? (
          /* 로그인 게이트 */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">로그인 후 상담할 수 있어요</p>
              <p className="mt-1 text-sm text-gray-600">
                카카오 로그인하면 상담 내용이 저장되고, 답변을 이어서 확인할 수 있습니다.
              </p>
            </div>
            <Button
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
              onClick={() => { onClose?.(); router.push('/login') }}
            >
              카카오 로그인
            </Button>
          </div>
        ) : (
          <>
            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 인트로(상담원) */}
              <div className="flex justify-start">
                <div className="flex items-start gap-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Headset className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-lg p-3 bg-gray-100 text-gray-900">
                    <p className="text-sm">{GREETING}</p>
                  </div>
                </div>
              </div>

              {messages.map((msg) => {
                const isUser = msg.sender === 'user'
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-yellow-500' : 'bg-green-500'}`}>
                        {isUser ? <User className="h-4 w-4 text-white" /> : <Headset className="h-4 w-4 text-white" />}
                      </div>
                      <div className={`rounded-lg p-3 ${isUser ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <p className={`text-xs mt-1 ${isUser ? 'text-yellow-100' : 'text-gray-500'}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {error ? (
              <p className="px-4 py-1 text-xs text-rose-600">{error}</p>
            ) : null}

            {/* 빠른 문의 (대화 시작 전) */}
            {messages.length === 0 && (
              <div className="px-4 py-2 border-t bg-gray-50">
                <p className="text-xs text-gray-600 mb-2">빠른 문의:</p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_REPLIES.map((reply) => (
                    <Button
                      key={reply}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      disabled={sending || !conversationId}
                      onClick={() => handleSend(reply)}
                    >
                      {reply}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 입력 영역 */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1"
                  disabled={!conversationId}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!inputMessage.trim() || sending || !conversationId}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Enter로 전송</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ChatSupport

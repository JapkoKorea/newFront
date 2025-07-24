import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Send, X, MessageCircle, Bot, User, Clock } from 'lucide-react'

const ChatSupport = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      message: '안녕하세요! 비에이 택시투어 상담원입니다. 무엇을 도와드릴까요?',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const quickReplies = [
    '예약 문의',
    '가격 문의',
    '코스 추천',
    '취소/변경',
    '픽업 서비스',
    '날씨 문의'
  ]

  const botResponses = {
    '예약 문의': '예약을 도와드리겠습니다. 원하시는 투어 날짜와 인원수를 알려주세요.',
    '가격 문의': '기본 코스(3시간) ¥15,000, 프리미엄 코스(5시간) ¥25,000, 풀데이 코스(8시간) ¥40,000입니다. 인원수에 따라 할인도 가능합니다.',
    '코스 추천': '계절과 관심사에 따라 맞춤 코스를 추천해드립니다. 어떤 장소에 관심이 있으신가요?',
    '취소/변경': '24시간 전까지는 무료 취소/변경이 가능합니다. 예약번호를 알려주시면 확인해드리겠습니다.',
    '픽업 서비스': '삿포로 시내 주요 호텔과 신치토세 공항에서 픽업 서비스를 제공합니다. 숙소 위치를 알려주세요.',
    '날씨 문의': '현재 비에이 날씨를 확인해드리고, 투어에 적합한 복장을 안내해드리겠습니다.'
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = (message = inputMessage) => {
    if (!message.trim()) return

    const newMessage = {
      id: messages.length + 1,
      type: 'user',
      message: message.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInputMessage('')
    setIsTyping(true)

    // 봇 응답 시뮬레이션
    setTimeout(() => {
      const botResponse = botResponses[message] || 
        '감사합니다. 더 자세한 상담을 위해 전화(+81-80-1234-5678)로 연락주시거나, 예약 페이지를 이용해주세요.'
      
      const botMessage = {
        id: messages.length + 2,
        type: 'bot',
        message: botResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
      setIsTyping(false)
    }, 1000 + Math.random() * 2000)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
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
              <p className="text-xs opacity-90">평균 응답시간: 1분</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-green-600">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-2 max-w-[80%] ${
                msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.type === 'user' ? 'bg-yellow-500' : 'bg-green-500'
                }`}>
                  {msg.type === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className={`rounded-lg p-3 ${
                  msg.type === 'user' 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    msg.type === 'user' ? 'text-yellow-100' : 'text-gray-500'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 빠른 답변 */}
        {messages.length === 1 && (
          <div className="px-4 py-2 border-t bg-gray-50">
            <p className="text-xs text-gray-600 mb-2">빠른 문의:</p>
            <div className="flex flex-wrap gap-1">
              {quickReplies.map((reply, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleSendMessage(reply)}
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
            />
            <Button 
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-green-500 hover:bg-green-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enter를 눌러 메시지를 보내세요
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChatSupport


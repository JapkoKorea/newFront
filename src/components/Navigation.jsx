'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { MessageCircle, HelpCircle, Menu, X } from 'lucide-react'
import FAQ from './FAQ.jsx'
import ChatSupport from './ChatSupport.jsx'
import ServiceSelector from './ServiceSelector.jsx'
import { useAppShell } from '@/lib/appShell.jsx'
import { clearSession, readSession } from '@/lib/session.js'

export default function Navigation() {
  const [isServiceSelectorOpen, setIsServiceSelectorOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // 상담/FAQ 모달 상태는 전역 셸이 들고 있다. 하단 액션 바 같은 다른 화면 요소도 같은 모달을 연다.
  const { hasBottomBar, isChatOpen, isFAQOpen, openChat, openFAQ, closeChat, closeFAQ } = useAppShell()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [nickname, setNickname] = useState('')
  const router = useRouter()
  const pathname = usePathname()

  // 토큰이 "있는지" 가 아니라 "아직 유효한지" 를 본다. 만료된 토큰이 남아
  // 있으면 로그인된 것처럼 보이다가 결제 단계에서야 401 로 튕겼다.
  useEffect(() => {
    const session = readSession()
    setIsLoggedIn(session.isLoggedIn)
    setNickname(session.nickname)
  }, [pathname])

  const handleLogout = () => {
    clearSession()
    setIsLoggedIn(false)
    setNickname('')
    router.push('/')
  }

  const openServiceSelector = () => {
    closeFAQ(); closeChat()
    setIsServiceSelectorOpen(true); setIsMobileMenuOpen(false)
  }
  const openBooking = () => {
    setIsServiceSelectorOpen(false)
    setIsMobileMenuOpen(false)
    // /tours 는 /products 로 리다이렉트되므로 곧장 보낸다.
    router.push('/products')
  }
  const openCustomBooking = () => {
    setIsServiceSelectorOpen(false)
    setIsMobileMenuOpen(false)
    // 코스 맥락 없이 들어가므로 예약 화면이 코스 선택부터 시작한다.
    router.push('/booking')
  }
  const openTransfer = () => {
    setIsServiceSelectorOpen(false)
    setIsMobileMenuOpen(false)
    router.push('/transfer-booking')
  }
  // 메뉴에서 열 때는 모바일 메뉴를 같이 닫는다.
  const openFAQFromMenu = () => { setIsMobileMenuOpen(false); openFAQ() }
  const openChatFromMenu = () => { setIsMobileMenuOpen(false); openChat() }

  const navLinkClass = "text-gray-500 hover:text-yellow-500 px-3 py-2 rounded-md text-sm font-medium"

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="inline-flex min-h-11 items-center">
              <h1 className="text-2xl font-bold text-yellow-500">잽코 택시투어</h1>
            </Link>

            {/* 데스크탑 메뉴 */}
            <div className="hidden md:flex items-baseline space-x-1">
              <Link href="/" className={navLinkClass}>홈</Link>
              <button onClick={openServiceSelector} className={navLinkClass}>예약하기</button>
              <Link href="/pricing" className={navLinkClass}>요금 안내</Link>
              <Link href="/reservations" className={navLinkClass}>예약 확인</Link>
              <button onClick={openFAQFromMenu} className={navLinkClass}>FAQ</button>
              <button onClick={openChatFromMenu} className={navLinkClass}>상담</button>
              {isLoggedIn && nickname && (
                <span className="text-sm text-gray-700 ml-2">{nickname}님</span>
              )}
              <Button
                className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-2 rounded-md text-sm font-medium ml-4"
                onClick={isLoggedIn ? handleLogout : () => router.push('/login')}
              >
                {isLoggedIn ? '로그아웃' : '카카오 로그인'}
              </Button>
            </div>

            {/* 모바일 햄버거 */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label={isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen(p => !p)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* 모바일 메뉴 */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t py-3 space-y-1">
              {[
                { label: '홈', href: '/' },
                { label: '요금 안내', href: '/pricing' },
                { label: '예약 확인', href: '/reservations' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex min-h-11 items-center rounded px-3 text-sm font-medium text-gray-700 hover:bg-yellow-50"
                >
                  {label}
                </Link>
              ))}
              <button onClick={openServiceSelector} className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm font-medium text-gray-700 hover:bg-yellow-50">예약하기</button>
              <button onClick={openFAQFromMenu} className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm font-medium text-gray-700 hover:bg-yellow-50">FAQ</button>
              <button onClick={openChatFromMenu} className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm font-medium text-gray-700 hover:bg-yellow-50">상담</button>
              {isLoggedIn && nickname && <p className="px-3 py-1 text-sm text-gray-700">{nickname}님 환영합니다.</p>}
              <Button
                className="mt-2 h-11 w-full bg-yellow-400 text-white hover:bg-yellow-500"
                onClick={() => { setIsMobileMenuOpen(false); isLoggedIn ? handleLogout() : router.push('/login') }}
              >
                {isLoggedIn ? '로그아웃' : '카카오 로그인'}
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/*
        플로팅 액션 버튼.
        하단 고정 액션 바가 있는 화면에서는 그 위에 겹쳐 1차 액션을 가리므로 접는다.
        그런 화면은 상담 진입점을 자기 액션 바 안에 둔다.
      */}
      {!hasBottomBar && (
        <div className="bottom-safe fixed right-4 z-50 space-y-3 sm:right-6">
          <Button
            size="icon"
            aria-label="채팅 상담"
            className="h-12 w-12 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600"
            onClick={openChat}
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            aria-label="자주 묻는 질문"
            className="h-12 w-12 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600"
            onClick={openFAQ}
          >
            <HelpCircle className="h-6 w-6" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* 모달들 */}
      <ServiceSelector isOpen={isServiceSelectorOpen} onClose={() => setIsServiceSelectorOpen(false)} onSelectTour={openBooking} onSelectCustom={openCustomBooking} onSelectTransfer={openTransfer} />
      <FAQ isOpen={isFAQOpen} onClose={closeFAQ} onStartChat={openChat} />
      <ChatSupport isOpen={isChatOpen} onClose={closeChat} />
    </>
  )
}

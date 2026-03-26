'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { MessageCircle, HelpCircle, Menu, X } from 'lucide-react'
import TaxiBooking from './TaxiBooking.jsx'
import FAQ from './FAQ.jsx'
import ChatSupport from './ChatSupport.jsx'
import ServiceSelector from './ServiceSelector.jsx'
import TransferBooking from './TransferBooking.jsx'

export default function Navigation() {
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isServiceSelectorOpen, setIsServiceSelectorOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isFAQOpen, setIsFAQOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [nickname, setNickname] = useState('')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const jwtToken = localStorage.getItem('jwt')
    const userRaw = localStorage.getItem('user')
    if (!jwtToken || !userRaw) {
      setIsLoggedIn(false)
      setNickname('')
      return
    }
    try {
      const parsedUser = JSON.parse(userRaw)
      setIsLoggedIn(true)
      setNickname(parsedUser?.nickname || parsedUser?.userName || '')
    } catch {
      setIsLoggedIn(false)
      setNickname('')
    }
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('jwt')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setNickname('')
    router.push('/')
  }

  const openServiceSelector = () => {
    setIsFAQOpen(false); setIsChatOpen(false)
    setIsBookingOpen(false); setIsTransferOpen(false)
    setIsServiceSelectorOpen(true); setIsMobileMenuOpen(false)
  }
  const openBooking = () => {
    setIsServiceSelectorOpen(false)
    setIsBookingOpen(true); setIsMobileMenuOpen(false)
  }
  const openTransfer = () => {
    setIsServiceSelectorOpen(false)
    setIsTransferOpen(true); setIsMobileMenuOpen(false)
  }
  const openFAQ = () => {
    setIsBookingOpen(false); setIsChatOpen(false)
    setIsFAQOpen(true); setIsMobileMenuOpen(false)
  }
  const openChat = () => {
    setIsBookingOpen(false); setIsFAQOpen(false)
    setIsChatOpen(true); setIsMobileMenuOpen(false)
  }

  const navLinkClass = "text-gray-500 hover:text-yellow-500 px-3 py-2 rounded-md text-sm font-medium"

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <h1 className="text-2xl font-bold text-yellow-500">잽코 택시투어</h1>
            </Link>

            {/* 데스크탑 메뉴 */}
            <div className="hidden md:flex items-baseline space-x-1">
              <Link href="/" className={navLinkClass}>홈</Link>
              <Link href="/tours" className={navLinkClass}>투어 코스</Link>
              <Link href="/guide" className={navLinkClass}>관광 가이드</Link>
              <button onClick={openServiceSelector} className={navLinkClass}>예약하기</button>
              <Link href="/pricing" className={navLinkClass}>요금 안내</Link>
              <Link href="/reservations" className={navLinkClass}>예약 확인</Link>
              <button onClick={openFAQ} className={navLinkClass}>FAQ</button>
              <button onClick={openChat} className={navLinkClass}>상담</button>
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
              <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(p => !p)}>
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* 모바일 메뉴 */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t py-3 space-y-1">
              {[
                { label: '홈', href: '/' },
                { label: '투어 코스', href: '/tours' },
                { label: '관광 가이드', href: '/guide' },
                { label: '요금 안내', href: '/pricing' },
                { label: '예약 확인', href: '/reservations' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50 rounded"
                >
                  {label}
                </Link>
              ))}
              <button onClick={openServiceSelector} className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50 rounded">예약하기</button>
              <button onClick={openFAQ} className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50 rounded">FAQ</button>
              <button onClick={openChat} className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50 rounded">상담</button>
              {isLoggedIn && nickname && <p className="px-3 py-1 text-sm text-gray-700">{nickname}님 환영합니다.</p>}
              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white mt-2"
                onClick={() => { setIsMobileMenuOpen(false); isLoggedIn ? handleLogout() : router.push('/login') }}
              >
                {isLoggedIn ? '로그아웃' : '카카오 로그인'}
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* 플로팅 액션 버튼 */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
        <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg" onClick={openChat}>
          <MessageCircle className="h-6 w-6" />
        </Button>
        <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg" onClick={openFAQ}>
          <HelpCircle className="h-6 w-6" />
        </Button>
      </div>

      {/* 모달들 */}
      <ServiceSelector isOpen={isServiceSelectorOpen} onClose={() => setIsServiceSelectorOpen(false)} onSelectTour={openBooking} onSelectTransfer={openTransfer} />
      <TaxiBooking isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
      <TransferBooking isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} />
      <FAQ isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} onStartChat={openChat} />
      <ChatSupport isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  )
}

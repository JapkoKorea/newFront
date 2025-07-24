import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { ChevronDown, MapPin, Clock, Users, Star, MessageCircle, HelpCircle } from 'lucide-react'
import TaxiBooking from './components/TaxiBooking.jsx'
import FAQ from './components/FAQ.jsx'
import ChatSupport from './components/ChatSupport.jsx'
import './App.css'
import { useNavigate } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import LoginKakaoButton from './components/LoginKakao.jsx'

// 이미지 import
import biei1 from './assets/xpGwZKvsyDaZ.webp'
import biei2 from './assets/YJZRJCUmiC0K.jpg'
import biei3 from './assets/Ug7lCEJXjCwZ.jpg'
import biei5 from './assets/HGsZN8MV1MIb.jpg'
import biei6 from './assets/Mg1bQjbINPBk.jpg'

function App() {
  const [currentSection, setCurrentSection] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isFAQOpen, setIsFAQOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const navigate = useNavigate();

  // 풀페이지 스크롤 구현
  useEffect(() => {
    const handleWheel = (e) => {
      if (isScrolling) return
      
      e.preventDefault()
      setIsScrolling(true)
      
      if (e.deltaY > 0 && currentSection < 1) {
        setCurrentSection(currentSection + 1)
      } else if (e.deltaY < 0 && currentSection > 0) {
        setCurrentSection(currentSection - 1)
      }
      
      setTimeout(() => setIsScrolling(false), 1000)
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [currentSection, isScrolling])

  return (
    <div className="h-screen overflow-hidden">
      {/* 네비게이션 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-yellow-500">비에이 택시투어</h1>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#" className="text-gray-900 hover:text-yellow-500 px-3 py-2 rounded-md text-sm font-medium">택시투어</a>
                <a href="#" className="text-gray-500 hover:text-yellow-500 px-3 py-2 rounded-md text-sm font-medium">식당예약</a>
                <button 
                  onClick={() => setIsFAQOpen(true)}
                  className="text-gray-500 hover:text-yellow-500 px-3 py-2 rounded-md text-sm font-medium"
                >
                  FAQ
                </button>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="text-gray-500 hover:text-yellow-500 px-3 py-2 rounded-md text-sm font-medium"
                >
                  상담
                </button>
                <Button 
                  className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-2 rounded-md text-sm font-medium ml-4"
                  onClick={() => navigate('/login')}
                >
                  카카오 로그인
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 라우팅 */}
      <Routes>
        <Route path="/" element={
          <>
            {/* 메인 컨테이너 */}
            <div 
              className="transition-transform duration-1000 ease-in-out"
              style={{ transform: `translateY(-${currentSection * 100}vh)` }}
            >
              {/* 첫 번째 섹션 - 히어로 */}
              <section className="h-screen relative flex items-center justify-center">
                <div 
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${biei1})` }}
                >
                  <div className="absolute inset-0 bg-black/40"></div>
                </div>
                
                <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
                  <div className="mb-8">
                    <p className="text-lg mb-4 opacity-90">서비스</p>
                    <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
                      <span className="text-yellow-400">service</span>
                    </h1>
                    <div className="w-24 h-24 mx-auto bg-blue-600 rounded-lg flex items-center justify-center mb-8">
                      <span className="text-3xl font-bold text-white">T</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h2 className="text-2xl md:text-3xl font-semibold">
                      믿고 부르는 가장 편리한 비에이 택시투어
                    </h2>
                    <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
                      복잡함은 빼고 효율만 남겼습니다. 일본 여행객을 위한 전문 택시투어 서비스를 지금 소개합니다.
                    </p>
                  </div>
                </div>

                {/* 스크롤 인디케이터 */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
                  <ChevronDown size={32} />
                </div>
              </section>

              {/* 두 번째 섹션 - 택시투어 소개 */}
              <section className="h-screen bg-gray-50 flex items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* 왼쪽 - 텍스트 콘텐츠 */}
                    <div className="space-y-8">
                      <div>
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                          전문 가이드와 함께하는
                          <br />
                          <span className="text-yellow-500">비에이 택시투어</span>
                        </h2>
                        <p className="text-lg text-gray-600 leading-relaxed">
                          현지 전문 가이드가 동행하여 비에이의 숨겨진 명소부터 유명 관광지까지 
                          안전하고 편안하게 안내해드립니다. 언어 걱정 없이 일본 여행을 즐기세요.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <MapPin className="h-6 w-6 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">맞춤형 코스</h3>
                            <p className="text-sm text-gray-600">원하는 장소와 시간에 맞춘 개인 맞춤 투어</p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <Clock className="h-6 w-6 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">시간 절약</h3>
                            <p className="text-sm text-gray-600">대중교통 이용 시간을 대폭 단축</p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <Users className="h-6 w-6 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">전문 가이드</h3>
                            <p className="text-sm text-gray-600">현지 문화와 역사를 아는 전문 가이드</p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <Star className="h-6 w-6 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">프리미엄 서비스</h3>
                            <p className="text-sm text-gray-600">깨끗하고 안전한 차량으로 편안한 여행</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button 
                          size="lg" 
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3"
                          onClick={() => setIsBookingOpen(true)}
                        >
                          택시투어 예약하기
                        </Button>
                        <Button 
                          variant="outline" 
                          size="lg" 
                          className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 px-8 py-3"
                          onClick={() => setIsChatOpen(true)}
                        >
                          <MessageCircle className="mr-2 h-5 w-5" />
                          채팅 상담
                        </Button>
                      </div>
                    </div>

                    {/* 오른쪽 - 이미지 갤러리 */}
                    <div className="relative">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <img 
                            src={biei2} 
                            alt="비에이 크리스마스 트리" 
                            className="w-full h-48 object-cover rounded-lg shadow-lg"
                          />
                          <img 
                            src={biei5} 
                            alt="비에이 겨울 풍경" 
                            className="w-full h-32 object-cover rounded-lg shadow-lg"
                          />
                        </div>
                        <div className="space-y-4 mt-8">
                          <img 
                            src={biei3} 
                            alt="비에이 설원" 
                            className="w-full h-32 object-cover rounded-lg shadow-lg"
                          />
                          <img 
                            src={biei6} 
                            alt="비에이 관광지" 
                            className="w-full h-48 object-cover rounded-lg shadow-lg"
                          />
                        </div>
                      </div>
                      
                      {/* 플로팅 카드 */}
                      <div className="absolute -bottom-4 -left-4 bg-white p-4 rounded-lg shadow-xl">
                        <div className="flex items-center space-x-2">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" />
                            ))}
                          </div>
                          <span className="text-sm font-semibold">4.9</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">1,200+ 만족한 고객</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* 플로팅 액션 버튼 */}
            <div className="fixed bottom-6 right-6 z-50 space-y-3">
              <Button 
                size="lg" 
                className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg"
                title="채팅 상담"
                onClick={() => setIsChatOpen(true)}
              >
                <MessageCircle className="h-6 w-6" />
              </Button>
              <Button 
                size="lg" 
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg"
                title="FAQ"
                onClick={() => setIsFAQOpen(true)}
              >
                <HelpCircle className="h-6 w-6" />
              </Button>
            </div>

            {/* 섹션 인디케이터 */}
            <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 space-y-2">
              {[0, 1].map((index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSection(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    currentSection === index ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* 택시 예약 모달 */}
            <TaxiBooking 
              isOpen={isBookingOpen} 
              onClose={() => setIsBookingOpen(false)} 
            />

            {/* FAQ 모달 */}
            <FAQ 
              isOpen={isFAQOpen} 
              onClose={() => setIsFAQOpen(false)} 
            />

            {/* 채팅 상담 모달 */}
            <ChatSupport 
              isOpen={isChatOpen} 
              onClose={() => setIsChatOpen(false)} 
            />
          </>
        } />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </div>
  )
}

// 임시 LoginPage 컴포넌트
function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">카카오 로그인</h2>
      <LoginKakaoButton />
    </div>
  )
}

export default App


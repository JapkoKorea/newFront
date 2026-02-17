import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Calendar, Clock, Users, MapPin, CreditCard, X, ChevronLeft, ChevronRight, AlertTriangle, Search, Plus } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import MapContainer, { COORDS_DICT } from '@/components/MapContainer.jsx'

const TaxiBooking = ({ isOpen, onClose }) => {
  const today = new Date().toISOString().split('T')[0]
  const totalSteps = 3
  const stepLabels = ['코스 선택', '일정 설정', '예약자 정보']
  const [bookingData, setBookingData] = useState({
    departure: '',
    destination: '',
    date: today,
    time: '',
    duration: '',
    passengers: '',
    course: '',
    specialRequests: '',
    name: '',
    phone: '',
    email: '',
    selectedSpots: []
  })

  const [currentStep, setCurrentStep] = useState(1)
  const [hoveredSpot, setHoveredSpot] = useState(null)
  const [showValidation, setShowValidation] = useState(false)

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const popularDestinations = [
    '크리스마스 나무',
    '세븐스타 나무',
    '켄과 메리 나무',
    '마일드세븐 언덕',
    '탁신관',
    '흰수염폭포',
    '청의 호수',
    '패치워크의 길',
    '닝구르 테라스',
    '팜 토미타'
  ]

  const tourCourses = [
    { 
      id: 'standard', 
      name: '스탠다드 비에이 명소 코스', 
      duration: '3시간',
      departure: '아사히카와역',
      destination: '비에이역',
      spots: ['크리스마스 나무', '탁신관', '흰수염폭포'],
      description: '가장 인기 있는 정석 루트. 짧은 시간 안에 비에이의 대표 명소를 둘러보는 코스.'
    },
    { 
      id: 'nature', 
      name: '비에이 자연 감성 코스', 
      duration: '3시간',
      departure: '아사히카와역',
      destination: '비에이역',
      spots: ['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '청의 호수'],
      description: '사진 촬영을 좋아하거나 자연경관 중심의 여유로운 투어를 원하는 분께 추천.'
    },
    { 
      id: 'family', 
      name: '가족 맞춤 코스', 
      duration: '3시간',
      departure: '아사히카와역',
      destination: '아사히카와역',
      spots: ['크리스마스 나무', '사계채언덕 (四季彩の丘)', '아사히야마 동물원'],
      description: '아이가 있는 가족에게 적합한 코스. 동물원 + 가벼운 자연 관광 조합.'
    },
    { 
      id: 'extended', 
      name: '비에이~후라노 확장 코스', 
      duration: '4-6시간',
      departure: '비에이역 또는 후라노역',
      destination: '아사히카와역',
      spots: ['청의 호수', '흰수염폭포', '닝구르 테라스', '팜 토미타 (계절 따라 선택)'],
      description: '꽃이 피는 계절(6~8월)에는 후라노까지 연결된 장거리 루트로 추천.'
    },
    { 
      id: 'photo', 
      name: '감성 사진 명소 투어', 
      duration: '4-6시간',
      departure: '아사히카와역',
      destination: '아사히카와역',
      spots: ['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '패치워크의 길', '크리스마스트리의 나무'],
      description: '사진 찍기 좋은 장소들만 모아 구성. 인스타 감성 코스로 인기.'
    },
    { 
      id: 'custom', 
      name: '커스텀 코스 구성하기', 
      duration: '협의',
      departure: '',
      destination: '',
      spots: [],
      description: '원하는 장소와 시간으로 맞춤 제작'
    }
  ]

  const handleInputChange = (field, value) => {
    setBookingData(prev => ({ ...prev, [field]: value }))
  }

  const handleCourseSelect = (courseId) => {
    const selectedCourse = tourCourses.find(c => c.id === courseId)
    setBookingData(prev => ({
      ...prev,
      course: courseId,
      departure: selectedCourse.departure,
      destination: selectedCourse.destination,
      selectedSpots: selectedCourse.spots
    }))
  }

  const handleSpotToggle = (spot) => {
    setBookingData(prev => {
      const spots = prev.selectedSpots || []
      const newSpots = spots.includes(spot) 
        ? spots.filter(s => s !== spot)
        : [...spots, spot]
      return { ...prev, selectedSpots: newSpots }
    })
  }

  const handleSpotAdd = (spotName) => {
    setBookingData(prev => ({
      ...prev,
      selectedSpots: [...(prev.selectedSpots || []), spotName]
    }))
  }

  const handleSpotRemove = (spot) => {
    setBookingData(prev => ({
      ...prev,
      selectedSpots: (prev.selectedSpots || []).filter(s => s !== spot)
    }))
  }

  const handleNext = () => {
    if (currentStep < totalSteps && canProceedToNext()) {
      setShowValidation(false)
      setCurrentStep(currentStep + 1)
      return
    }

    setShowValidation(true)
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    if (!canSubmit()) {
      setShowValidation(true)
      return
    }

    // 예약 처리 로직
    alert('예약이 접수되었습니다! 곧 연락드리겠습니다.')
    onClose()
  }

  const getStepErrors = (step) => {
    if (step === 1) {
      return bookingData.course ? [] : ['투어 코스를 하나 선택해 주세요.']
    }

    if (step === 2) {
      const errors = []

      if (!bookingData.date) errors.push('투어 날짜를 선택해 주세요.')
      if (!bookingData.time) errors.push('투어 시작 시간을 선택해 주세요.')
      if (!bookingData.passengers) errors.push('탑승 인원을 선택해 주세요.')
      if (!bookingData.departure) errors.push('출발지를 입력해 주세요.')
      if (!bookingData.destination) errors.push('도착지를 입력해 주세요.')

      return errors
    }

    if (step === 3) {
      const errors = []

      if (!bookingData.name) errors.push('예약자 이름을 입력해 주세요.')
      if (!bookingData.phone) errors.push('연락처를 입력해 주세요.')
      if (!bookingData.email) errors.push('이메일을 입력해 주세요.')

      return errors
    }

    return []
  }

  const canProceedToNext = () => {
    return getStepErrors(currentStep).length === 0
  }

  const canSubmit = () => getStepErrors(3).length === 0
  const progressPercent = Math.round((currentStep / totalSteps) * 100)
  const selectedCourse = tourCourses.find(c => c.id === bookingData.course)
  const currentStepErrors = getStepErrors(currentStep)

  return (
    <div 
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${isOpen ? '' : 'hidden'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">택시 투어 예약</h2>
            <p className="text-sm text-gray-500 mt-1">3단계로 간단하게 예약을 완료할 수 있어요.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 진행 단계 표시 */}
        <div className="p-6 border-b space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>진행률</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-center">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              <div className={`ml-2 text-sm ${currentStep >= step ? 'text-yellow-600' : 'text-gray-400'}`}>
                {stepLabels[step - 1]}
              </div>
              {step < 3 && <div className="w-12 h-px bg-gray-300 mx-4" />}
            </div>
          ))}
          </div>
        </div>

        <div className="p-6">
          {showValidation && currentStepErrors.length > 0 && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">입력 확인이 필요해요</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-700 space-y-1">
                {currentStepErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {(currentStep === 2 || currentStep === 3) && (
            <div className="mb-5 rounded-lg border bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">선택 코스</p>
                <p className="font-medium text-gray-900">{selectedCourse?.name || '아직 선택 전'}</p>
              </div>
              <div>
                <p className="text-gray-500">방문 장소 수</p>
                <p className="font-medium text-gray-900">{bookingData.selectedSpots?.length || 0}곳</p>
              </div>
            </div>
          )}

          {/* 1단계: 코스 선택 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* 지역 안내 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">투어 지역 안내</h4>
                    <p className="text-sm text-blue-700">
                      비에이·아사히카와 지역에서의 탑승을 권장합니다. 삿포로에서의 출발은 
                      일본 교통권, 톨비, 타지역 이동비용 등의 문제로 권장하지 않습니다. 
                      필요하시면 별도 문의해 주세요.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">투어 코스를 선택해주세요</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tourCourses.map((course) => (
                    <Card 
                      key={course.id} 
                      className={`cursor-pointer transition-all ${
                        bookingData.course === course.id ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:shadow-md'
                      }`}
                      onClick={() => handleCourseSelect(course.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{course.name}</CardTitle>
                          <span className="text-sm font-medium text-gray-600">{course.duration}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>출발: {course.departure}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>도착: {course.destination}</span>
                        </div>
                        <p className="text-sm text-gray-600">{course.description}</p>
                        {course.spots.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {course.spots.map((spot, index) => (
                              <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {spot}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2단계: 일정 설정 */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">투어 일정을 설정해주세요</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">투어 날짜</Label>
                    <Input
                      id="date"
                      type="date"
                      min={today}
                      value={bookingData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">투어 시작 시간</Label>
                    <Select value={bookingData.time} onValueChange={(value) => handleInputChange('time', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="시간 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="09:00">오전 9:00</SelectItem>
                        <SelectItem value="10:00">오전 10:00</SelectItem>
                        <SelectItem value="11:00">오전 11:00</SelectItem>
                        <SelectItem value="13:00">오후 1:00</SelectItem>
                        <SelectItem value="14:00">오후 2:00</SelectItem>
                        <SelectItem value="15:00">오후 3:00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="passengers">탑승 인원</Label>
                    <Select value={bookingData.passengers} onValueChange={(value) => handleInputChange('passengers', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="인원 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1명</SelectItem>
                        <SelectItem value="2">2명</SelectItem>
                        <SelectItem value="3">3명</SelectItem>
                        <SelectItem value="4">4명</SelectItem>
                        <SelectItem value="5+">5명 이상</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration">예상 소요 시간</Label>
                    <Select value={bookingData.duration} onValueChange={(value) => handleInputChange('duration', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="시간 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3시간</SelectItem>
                        <SelectItem value="5">5시간</SelectItem>
                        <SelectItem value="8">8시간 (풀데이)</SelectItem>
                        <SelectItem value="custom">직접 입력</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 출발지/도착지 설정 */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="departure">출발지</Label>
                    <Input
                      id="departure"
                      placeholder="출발지를 입력하거나 선택해주세요"
                      value={bookingData.departure}
                      onChange={(e) => handleInputChange('departure', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="destination">도착지</Label>
                    <Input
                      id="destination"
                      placeholder="도착지를 입력하거나 선택해주세요"
                      value={bookingData.destination}
                      onChange={(e) => handleInputChange('destination', e.target.value)}
                    />
                  </div>
                </div>

                {/* 커스텀 코스인 경우 관광지 선택 */}
                {bookingData.course === 'custom' && (
                  <div className="space-y-4">
                    <div>
                      <Label>방문하고 싶은 장소 선택</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {popularDestinations.map((dest) => (
                          <Button
                            key={dest}
                            variant={bookingData.selectedSpots?.includes(dest) ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => handleSpotToggle(dest)}
                          >
                            {dest}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="specialRequests">특별 요청사항</Label>
                  <Textarea
                    id="specialRequests"
                    placeholder="아이 동반, 휠체어 이용, 특별한 요청사항 등을 입력해주세요"
                    value={bookingData.specialRequests}
                    onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                  />
                </div>
              </div>

              {/* 지도 영역 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">투어 경로</h3>
                <div className="h-96 rounded-lg overflow-hidden border">
                  <MapContainer
                    departure={bookingData.departure}
                    destination={bookingData.destination}
                    spots={bookingData.selectedSpots || []}
                    onPlaceChange={handleInputChange}
                    onSpotAdd={handleSpotAdd}
                    onSpotRemove={handleSpotRemove}
                    hoveredSpot={hoveredSpot}
                  />
                </div>
                
                {/* 선택된 관광지 목록 */}
                {bookingData.selectedSpots && bookingData.selectedSpots.length > 0 && (
                  <div className="space-y-2">
                    <Label>선택된 관광지</Label>
                    <div className="space-y-1">
                      {bookingData.selectedSpots.map((spot, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between bg-gray-50 p-2 rounded hover:bg-gray-100 transition-colors"
                          onMouseEnter={() => setHoveredSpot(spot)}
                          onMouseLeave={() => setHoveredSpot(null)}
                        >
                          <span className="text-sm">{spot}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSpotRemove(spot)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3단계: 예약자 정보 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">예약자 정보를 입력해주세요</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">이름 *</Label>
                  <Input
                    id="name"
                    placeholder="홍길동"
                    value={bookingData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">연락처 *</Label>
                  <Input
                    id="phone"
                    placeholder="010-1234-5678"
                    value={bookingData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">이메일 *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={bookingData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>

              {/* 예약 요약 */}
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-base">예약 요약</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>선택 코스:</span>
                    <span className="font-medium">
                      {tourCourses.find(c => c.id === bookingData.course)?.name || '미선택'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>출발지:</span>
                    <span className="font-medium">{bookingData.departure || '미선택'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>도착지:</span>
                    <span className="font-medium">{bookingData.destination || '미선택'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>투어 날짜:</span>
                    <span className="font-medium">{bookingData.date || '미선택'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>시작 시간:</span>
                    <span className="font-medium">{bookingData.time || '미선택'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>탑승 인원:</span>
                    <span className="font-medium">{bookingData.passengers || '미선택'}명</span>
                  </div>
                  {bookingData.selectedSpots && bookingData.selectedSpots.length > 0 && (
                    <div className="flex justify-between">
                      <span>방문 장소:</span>
                      <span className="font-medium text-right max-w-xs">
                        {bookingData.selectedSpots.join(', ')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <Button 
            variant="outline" 
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            이전
          </Button>
          
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button 
                onClick={handleNext}
                className="bg-yellow-500 hover:bg-yellow-600"
                disabled={!canProceedToNext()}
              >
                다음
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                className="bg-yellow-500 hover:bg-yellow-600"
                disabled={!canSubmit()}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                예약 완료
              </Button>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}

export default TaxiBooking

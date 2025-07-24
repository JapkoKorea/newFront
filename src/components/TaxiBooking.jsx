import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Calendar, Clock, MapPin, Users, Car, CreditCard, X } from 'lucide-react'

const TaxiBooking = ({ isOpen, onClose }) => {
  const [bookingData, setBookingData] = useState({
    departure: '',
    destination: '',
    date: '',
    time: '',
    duration: '',
    passengers: '',
    course: '',
    specialRequests: '',
    name: '',
    phone: '',
    email: ''
  })

  const [currentStep, setCurrentStep] = useState(1)

  const popularDestinations = [
    '비에이 크리스마스 트리',
    '시라스가 폭포',
    '푸른 연못',
    '팜 토미타',
    '젠트 힐',
    '패치워크 로드',
    '마일드 세븐 힐',
    '켄과 메리의 나무'
  ]

  const tourCourses = [
    { id: 'basic', name: '기본 코스 (3시간)', price: '¥15,000', description: '크리스마스 트리 + 푸른 연못 + 시라스가 폭포' },
    { id: 'premium', name: '프리미엄 코스 (5시간)', price: '¥25,000', description: '기본 코스 + 팜 토미타 + 젠트 힐 + 패치워크 로드' },
    { id: 'full', name: '풀데이 코스 (8시간)', price: '¥40,000', description: '모든 주요 관광지 + 현지 맛집 + 온천 체험' },
    { id: 'custom', name: '맞춤 코스', price: '협의', description: '원하는 장소와 시간으로 맞춤 제작' }
  ]

  const handleInputChange = (field, value) => {
    setBookingData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    // 예약 처리 로직
    alert('예약이 접수되었습니다! 곧 연락드리겠습니다.')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">택시 투어 예약</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center p-6 border-b">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              <div className={`ml-2 text-sm ${currentStep >= step ? 'text-yellow-600' : 'text-gray-400'}`}>
                {step === 1 && '코스 선택'}
                {step === 2 && '일정 설정'}
                {step === 3 && '예약자 정보'}
              </div>
              {step < 3 && <div className="w-12 h-px bg-gray-300 mx-4" />}
            </div>
          ))}
        </div>

        <div className="p-6">
          {/* 1단계: 코스 선택 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">투어 코스를 선택해주세요</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tourCourses.map((course) => (
                    <Card 
                      key={course.id} 
                      className={`cursor-pointer transition-all ${
                        bookingData.course === course.id ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:shadow-md'
                      }`}
                      onClick={() => handleInputChange('course', course.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{course.name}</CardTitle>
                          <span className="text-lg font-bold text-yellow-600">{course.price}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">{course.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {bookingData.course === 'custom' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="departure">출발지</Label>
                    <Input
                      id="departure"
                      placeholder="호텔명 또는 주소를 입력해주세요"
                      value={bookingData.departure}
                      onChange={(e) => handleInputChange('departure', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="destination">방문하고 싶은 장소</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {popularDestinations.map((dest) => (
                        <Button
                          key={dest}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            const current = bookingData.destination
                            const destinations = current ? current.split(', ') : []
                            if (destinations.includes(dest)) {
                              const filtered = destinations.filter(d => d !== dest)
                              handleInputChange('destination', filtered.join(', '))
                            } else {
                              handleInputChange('destination', [...destinations, dest].join(', '))
                            }
                          }}
                        >
                          {dest}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      className="mt-2"
                      placeholder="추가로 방문하고 싶은 장소나 특별한 요청사항을 입력해주세요"
                      value={bookingData.destination}
                      onChange={(e) => handleInputChange('destination', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2단계: 일정 설정 */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">투어 일정을 설정해주세요</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">투어 날짜</Label>
                  <Input
                    id="date"
                    type="date"
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
          )}

          {/* 3단계: 예약자 정보 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">예약자 정보를 입력해주세요</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    placeholder="홍길동"
                    value={bookingData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">연락처</Label>
                  <Input
                    id="phone"
                    placeholder="010-1234-5678"
                    value={bookingData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">이메일</Label>
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
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">예상 요금:</span>
                    <span className="font-bold text-yellow-600">
                      {tourCourses.find(c => c.id === bookingData.course)?.price || '협의'}
                    </span>
                  </div>
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
                disabled={
                  (currentStep === 1 && !bookingData.course) ||
                  (currentStep === 2 && (!bookingData.date || !bookingData.time || !bookingData.passengers))
                }
              >
                다음
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                className="bg-yellow-500 hover:bg-yellow-600"
                disabled={!bookingData.name || !bookingData.phone || !bookingData.email}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                예약 완료
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaxiBooking


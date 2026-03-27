'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Clock, MapPin, CreditCard, X, AlertTriangle } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import MapContainer, { COORDS_DICT } from '@/components/MapContainer.jsx'
import { useRouter } from 'next/navigation'

const BOOKING_DRAFT_STORAGE_KEY = 'booking_draft_v1'

const TaxiBooking = ({ isOpen = false, onClose, initialDraft = null, displayMode = 'modal' }) => {
  const router = useRouter()
  const isPageMode = displayMode === 'page'
  const today = new Date().toISOString().split('T')[0]
  const flowSteps = [1, 2, 3]
  const stepLabels = isPageMode
    ? ['코스 선택(완료)', '예약 입력', '예약자 정보']
    : ['코스 선택', '일정 설정', '예약자 정보']
  const totalSteps = flowSteps.length
  const getInitialBookingData = useCallback(() => ({
    departure: '비에이역',
    destination: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    duration: '',
    passengers: '',
    course: isPageMode ? 'custom' : '',
    specialRequests: '',
    name: '',
    phone: '',
    selectedSpots: []
  }), [isPageMode])
  const [bookingData, setBookingData] = useState(getInitialBookingData)

  const [currentStep, setCurrentStep] = useState(isPageMode ? 2 : 1)
  const [hoveredSpot, setHoveredSpot] = useState(null)
  const [showValidation, setShowValidation] = useState(false)
  const [draggedSpotIndex, setDraggedSpotIndex] = useState(null)
  const [dragOverSpotIndex, setDragOverSpotIndex] = useState(null)
  const [selectionModeRequest, setSelectionModeRequest] = useState(null)
  const [showBieiPairWarning, setShowBieiPairWarning] = useState(false)
  const [placeCoordinates, setPlaceCoordinates] = useState({
    departure: COORDS_DICT['비에이역'] || null,
    destination: null,
  })

  const popularDepartureChips = ['비에이역', '지요가오카역', '후라노역', '아사히카와역']
  const popularDestinationChips = ['비에이역', '지요가오카역', '후라노역', '아사히카와역']

  const passengerOptions = [
    { value: '1', label: '1명', helper: '개인 여행' },
    { value: '2', label: '2명', helper: '커플/친구' },
    { value: '3', label: '3명', helper: '소규모 팀' },
    { value: '4', label: '4명', helper: '가족 여행' },
    { value: '5', label: '5명', helper: '점보택시 권장' },
    { value: '6', label: '6명', helper: '점보택시 필수' },
    { value: '7', label: '7명', helper: '점보택시 필수' },
    { value: '8', label: '8명', helper: '점보택시 필수' },
  ]

  const durationOptions = [
    { value: '2', label: '2시간', helper: '최소 이용 시간' },
    { value: '3', label: '3시간', helper: '하이라이트 코스' },
    { value: '4', label: '4시간', helper: '여유 있는 코스' },
    { value: '5', label: '5시간', helper: '확장 코스' },
    { value: '6', label: '6시간', helper: '롱 코스' },
    { value: '8', label: '8시간', helper: '풀데이' },
  ]

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

  const spotGuideData = {
    '크리스마스 나무': { stayMinutes: 20, photoPoint: '정면 도로 쪽에서 단독 트리 구도를 잡기 좋아요.', nearby: ['세븐스타 나무', '패치워크의 길'] },
    '세븐스타 나무': { stayMinutes: 20, photoPoint: '일몰 전 역광 타이밍이 사진 색감이 가장 좋아요.', nearby: ['켄과 메리 나무', '마일드세븐 언덕'] },
    '켄과 메리 나무': { stayMinutes: 15, photoPoint: '길을 배경으로 나무를 세로 프레임으로 담기 좋습니다.', nearby: ['세븐스타 나무', '마일드세븐 언덕'] },
    '마일드세븐 언덕': { stayMinutes: 20, photoPoint: '언덕 라인이 보이는 높은 지점에서 촬영 추천.', nearby: ['켄과 메리 나무', '패치워크의 길'] },
    '탁신관': { stayMinutes: 30, photoPoint: '라벤더 시즌에는 입구 주변 색감이 가장 선명합니다.', nearby: ['크리스마스 나무', '청의 호수'] },
    '흰수염폭포': { stayMinutes: 25, photoPoint: '다리 중앙 지점에서 폭포 전경을 넓게 담아보세요.', nearby: ['청의 호수', '닝구르 테라스'] },
    '청의 호수': { stayMinutes: 35, photoPoint: '산책로 첫 포인트가 호수 색을 가장 진하게 볼 수 있어요.', nearby: ['흰수염폭포', '탁신관'] },
    '패치워크의 길': { stayMinutes: 25, photoPoint: '넓은 화각으로 구릉지 패턴을 담으면 대표 컷이 됩니다.', nearby: ['세븐스타 나무', '크리스마스 나무'] },
    '닝구르 테라스': { stayMinutes: 40, photoPoint: '해 질 무렵 조명 켜지는 시간대 방문을 추천합니다.', nearby: ['흰수염폭포', '팜 토미타'] },
    '팜 토미타': { stayMinutes: 50, photoPoint: '라벤더 밭 중앙 동선에서 파노라마 촬영 추천.', nearby: ['닝구르 테라스', '후라노역'] },
    '사계채언덕 (四季彩の丘)': { stayMinutes: 45, photoPoint: '전망 포인트에서 꽃밭 층을 배경으로 촬영하기 좋아요.', nearby: ['비에이역', '팜 토미타'] },
    '아사히야마 동물원': { stayMinutes: 70, photoPoint: '펭귄/물개 관찰관 앞 대기 시간을 고려해 주세요.', nearby: ['아사히카와역', '세븐스타 나무'] },
  }

  const tourCourses = [
    { id: 'standard', name: '스탠다드 비에이 명소 코스', duration: '3시간', departure: '아사히카와역', destination: '비에이역', spots: ['크리스마스 나무', '탁신관', '흰수염폭포'], description: '가장 인기 있는 정석 루트. 짧은 시간 안에 비에이의 대표 명소를 둘러보는 코스.' },
    { id: 'nature', name: '비에이 자연 감성 코스', duration: '3시간', departure: '아사히카와역', destination: '비에이역', spots: ['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '청의 호수'], description: '사진 촬영을 좋아하거나 자연경관 중심의 여유로운 투어를 원하는 분께 추천.' },
    { id: 'family', name: '가족 맞춤 코스', duration: '3시간', departure: '아사히카와역', destination: '아사히카와역', spots: ['크리스마스 나무', '사계채언덕 (四季彩の丘)', '아사히야마 동물원'], description: '아이가 있는 가족에게 적합한 코스. 동물원 + 가벼운 자연 관광 조합.' },
    { id: 'extended', name: '비에이~후라노 확장 코스', duration: '4-6시간', departure: '비에이역', destination: '아사히카와역', spots: ['청의 호수', '흰수염폭포', '닝구르 테라스', '팜 토미타'], description: '꽃이 피는 계절(6~8월)에는 후라노까지 연결된 장거리 루트로 추천.' },
    { id: 'photo', name: '감성 사진 명소 투어', duration: '4-6시간', departure: '아사히카와역', destination: '아사히카와역', spots: ['세븐스타 나무', '켄과 메리 나무', '마일드세븐 언덕', '패치워크의 길', '크리스마스 나무'], description: '사진 찍기 좋은 장소들만 모아 구성. 인스타 감성 코스로 인기.' },
    { id: 'custom', name: '커스텀 코스 구성하기', duration: '협의', departure: '', destination: '', spots: [], description: '원하는 장소와 시간으로 맞춤 제작' }
  ]

  const availableSpots = Array.from(new Set([...popularDestinations, ...tourCourses.flatMap((c) => c.spots)]))

  const spotMeta = Object.fromEntries(
    availableSpots.map((spot) => {
      const includedCourses = tourCourses.filter((c) => c.spots.includes(spot)).map((c) => c.name)
      return [spot, { isPopular: popularDestinations.includes(spot), includedCourses, guide: spotGuideData[spot] || null }]
    })
  )

  const shouldBlockBieiPair = (dep, dest) => dep === '비에이역' && dest === '비에이역'

  useEffect(() => {
    if (displayMode !== 'modal') {
      document.body.style.overflow = 'unset'
      return
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen, displayMode])

  useEffect(() => {
    if (displayMode !== 'modal' || !isOpen) return
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, displayMode])

  useEffect(() => {
    if (!(displayMode === 'page' || isOpen) || !initialDraft) return

    const nextDeparture = initialDraft.departure || '비에이역'
    const nextDestination = initialDraft.destination || ''
    const blockedPair = shouldBlockBieiPair(nextDeparture, nextDestination)
    const safeDestination = blockedPair ? '' : nextDestination
    const selectedSpots = Array.isArray(initialDraft.selectedSpots)
      ? initialDraft.selectedSpots
      : (Array.isArray(initialDraft.spots) ? initialDraft.spots : [])

    setBookingData((prev) => ({
      ...getInitialBookingData(),
      course: 'custom',
      departure: nextDeparture,
      destination: safeDestination,
      selectedSpots,
      specialRequests: initialDraft.specialRequests || prev.specialRequests || '',
    }))

    setPlaceCoordinates({
      departure: COORDS_DICT[nextDeparture] || null,
      destination: blockedPair ? null : (COORDS_DICT[safeDestination] || null),
    })

    const requestedStep = Number.isFinite(initialDraft.startStep) ? initialDraft.startStep : 2
    const nextStep = isPageMode ? Math.max(2, Math.min(3, requestedStep)) : Math.max(1, Math.min(3, requestedStep))
    setCurrentStep(nextStep)
    setShowValidation(false)
    if (blockedPair) setShowBieiPairWarning(true)
  }, [displayMode, isOpen, initialDraft, isPageMode, getInitialBookingData])

  useEffect(() => {
    if (!isPageMode) return
    setBookingData((prev) => (prev.course ? prev : { ...prev, course: 'custom' }))
    if (currentStep < 2) setCurrentStep(2)
  }, [isPageMode, currentStep])

  const handleInputChange = (field, value, coords = null) => {
    const nextDeparture = field === 'departure' ? value : bookingData.departure
    const nextDestination = field === 'destination' ? value : bookingData.destination
    const shouldReset = (field === 'departure' || field === 'destination') && shouldBlockBieiPair(nextDeparture, nextDestination)
    const finalValue = shouldReset ? '' : value
    setBookingData(prev => ({ ...prev, [field]: finalValue }))
    if (shouldReset) setShowBieiPairWarning(true)

    if (field === 'departure' || field === 'destination') {
      let resolved = coords
      if (!resolved && COORDS_DICT[finalValue]) resolved = COORDS_DICT[finalValue]
      if (!resolved && typeof finalValue === 'string' && finalValue.includes(',')) {
        const [lat, lng] = finalValue.split(',').map((c) => parseFloat(c.trim()))
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) resolved = { lat, lng }
      }
      setPlaceCoordinates((prev) => ({ ...prev, [field]: shouldReset ? null : resolved }))
    }
  }

  const handleCourseSelect = (courseId) => {
    const selectedCourse = tourCourses.find(c => c.id === courseId)
    const normalizedDeparture = (() => {
      const dep = selectedCourse.departure || ''
      if (dep.includes('비에이') || dep.includes('후라노')) return '비에이역'
      return dep
    })()
    setBookingData(prev => ({ ...prev, course: courseId, departure: normalizedDeparture, destination: selectedCourse.destination, selectedSpots: selectedCourse.spots }))
    setPlaceCoordinates((prev) => ({
      ...prev,
      departure: COORDS_DICT[normalizedDeparture] || prev.departure,
      destination: COORDS_DICT[selectedCourse.destination] || prev.destination,
    }))
  }

  const handleSpotToggle = (spot) => {
    setBookingData(prev => {
      const spots = prev.selectedSpots || []
      return { ...prev, selectedSpots: spots.includes(spot) ? spots.filter(s => s !== spot) : [...spots, spot] }
    })
  }

  const handleSpotAdd = (spotName) => {
    setBookingData(prev => ({ ...prev, selectedSpots: [...(prev.selectedSpots || []), spotName] }))
  }

  const handleSpotRemove = (spot) => {
    setBookingData(prev => ({ ...prev, selectedSpots: (prev.selectedSpots || []).filter(s => s !== spot) }))
  }

  const handleSpotDragStart = (index) => { setDraggedSpotIndex(index) }

  const handleSpotDragOver = (event, index) => {
    event.preventDefault()
    setDragOverSpotIndex(index)
  }

  const handleSpotDrop = (dropIndex) => {
    if (draggedSpotIndex === null || dropIndex === null || draggedSpotIndex === dropIndex) {
      setDraggedSpotIndex(null)
      setDragOverSpotIndex(null)
      return
    }
    setBookingData(prev => {
      const currentSpots = [...(prev.selectedSpots || [])]
      const [movedSpot] = currentSpots.splice(draggedSpotIndex, 1)
      currentSpots.splice(dropIndex, 0, movedSpot)
      return { ...prev, selectedSpots: currentSpots }
    })
    setDraggedSpotIndex(null)
    setDragOverSpotIndex(null)
  }

  const handleSpotDragEnd = () => {
    setDraggedSpotIndex(null)
    setDragOverSpotIndex(null)
  }

  const requestMapSelectionMode = (mode) => {
    setSelectionModeRequest({ mode, requestedAt: Date.now() })
  }

  const getStepErrors = (step) => {
    if (isPageMode && step === 1) return []
    if (step === 1) return bookingData.course ? [] : ['투어 코스를 하나 선택해 주세요.']
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
      return errors
    }
    return []
  }

  const canProceedToNext = () => getStepErrors(currentStep).length === 0
  const canSubmit = () => getStepErrors(3).length === 0

  const handleNext = () => {
    const maxStep = flowSteps[flowSteps.length - 1]
    if (currentStep < maxStep && canProceedToNext()) {
      setShowValidation(false)
      setCurrentStep(currentStep + 1)
      return
    }
    setShowValidation(true)
  }

  const handlePrev = () => {
    if (isPageMode && currentStep <= 2) return
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (!canSubmit()) { setShowValidation(true); return }

    const durationNumber = Number(bookingData.duration)
    const passengersNumber = Number(bookingData.passengers)
    if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
      alert('예상 소요 시간을 숫자로 선택해 주세요.')
      return
    }
    if (!Number.isFinite(passengersNumber) || passengersNumber <= 0) {
      alert('탑승 인원을 숫자로 선택해 주세요.')
      return
    }

    const selectedCourse = tourCourses.find((c) => c.id === bookingData.course)
    const desiredCourse = selectedCourse
      ? `${selectedCourse.name}${bookingData.selectedSpots?.length ? `: ${bookingData.selectedSpots.join(' > ')}` : ''}`
      : bookingData.selectedSpots.join(' > ')

    const payload = {
      english_name: bookingData.name,
      contact_number: bookingData.phone,
      tour_date: bookingData.date,
      tour_start_time: bookingData.time,
      tour_duration: durationNumber,
      number_of_people: passengersNumber,
      departure: bookingData.departure,
      destination: bookingData.destination,
      desired_course: desiredCourse,
    }

    const draft = {
      reservationPayload: payload,
      summary: {
        courseName: tourCourses.find((c) => c.id === bookingData.course)?.name || '미선택',
        departure: bookingData.departure,
        destination: bookingData.destination,
        date: bookingData.date,
        time: bookingData.time,
        duration: durationNumber,
        passengers: passengersNumber,
        selectedSpots: bookingData.selectedSpots || [],
      },
      createdAt: new Date().toISOString(),
    }

    try {
      sessionStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } catch {
      alert('예약 정보를 저장하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.')
      return
    }

    setCurrentStep(isPageMode ? 2 : 1)
    setShowValidation(false)
    setDraggedSpotIndex(null)
    setDragOverSpotIndex(null)
    setBookingData(getInitialBookingData())
    setPlaceCoordinates({ departure: COORDS_DICT['비에이역'] || null, destination: null })
    onClose()
    router.push('/pricing')
  }

  const visibleStepIndex = Math.max(0, flowSteps.indexOf(currentStep))
  const progressPercent = Math.round(((visibleStepIndex + 1) / totalSteps) * 100)
  const selectedCourse = tourCourses.find(c => c.id === bookingData.course)
  const currentStepErrors = getStepErrors(currentStep)

  const shouldRender = displayMode === 'page' || isOpen
  if (!shouldRender) return null

  const outerClassName = displayMode === 'modal'
    ? 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
    : 'w-full'

  const contentClassName = displayMode === 'modal'
    ? 'bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto'
    : 'bg-white rounded-lg w-full border shadow-sm'

  return (
    <div
      className={outerClassName}
      onMouseDown={(e) => {
        if (displayMode === 'modal' && e.target === e.currentTarget) onClose()
      }}
    >
      <div className={contentClassName} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">택시 투어 예약</h2>
            <p className="text-sm text-gray-500 mt-1">{isPageMode ? '코스 선택은 완료되었습니다. 남은 2단계를 입력해 주세요.' : '3단계로 간단하게 예약을 완료할 수 있어요.'}</p>
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
            {flowSteps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep >= step ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {index + 1}
                </div>
                <div className={`ml-2 text-sm ${currentStep >= step ? 'text-yellow-600' : 'text-gray-400'}`}>
                  {stepLabels[index]}
                </div>
                {index < flowSteps.length - 1 && <div className="w-12 h-px bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {showValidation && currentStepErrors.length > 0 && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">입력 확인이 필요해요</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-700 space-y-1">
                {currentStepErrors.map((error, index) => <li key={index}>{error}</li>)}
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

          {currentStep === 1 && !isPageMode && (
             <div className="space-y-6">
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
                      className={`cursor-pointer transition-all ${bookingData.course === course.id ? 'ring-2 ring-yellow-500 bg-yellow-50' : 'hover:shadow-md'}`}
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
                              <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">{spot}</span>
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

          {/* 2단계: 일정 설정 + 지도 */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">투어 일정을 설정해주세요</h3>

                {isPageMode && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    경로는 투어 상세에서 확정된 상태입니다. 이 화면에서는 일정과 요청사항만 입력해 주세요.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date" className="mb-1.5 block">투어 날짜</Label>
                    <Input
                      id="date"
                      type="date"
                      min={today}
                      value={bookingData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time" className="mb-1.5 block">투어 시작 시간</Label>
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
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Label className="text-sm font-semibold text-gray-900">탑승 인원 선택</Label>
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">필수</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {passengerOptions.map((option) => {
                        const isSelected = bookingData.passengers === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleInputChange('passengers', option.value)}
                            className={`rounded-lg border px-3 py-2 text-left transition ${isSelected ? 'border-yellow-500 bg-yellow-100 shadow-sm' : 'border-gray-200 bg-white hover:border-yellow-300'}`}
                          >
                            <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                            <p className="text-xs text-gray-500">{option.helper}</p>
                          </button>
                        )
                      })}
                    </div>
                    {!bookingData.passengers && <p className="mt-2 text-xs text-rose-600">탑승 인원을 먼저 선택해 주세요.</p>}
                  </div>

                  <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Label className="text-sm font-semibold text-gray-900">예상 소요 시간 선택</Label>
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">필수</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {durationOptions.map((option) => {
                        const isSelected = bookingData.duration === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleInputChange('duration', option.value)}
                            className={`rounded-lg border px-3 py-2 text-left transition ${isSelected ? 'border-yellow-500 bg-yellow-100 shadow-sm' : 'border-gray-200 bg-white hover:border-yellow-300'}`}
                          >
                            <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                            <p className="text-xs text-gray-500">{option.helper}</p>
                          </button>
                        )
                      })}
                    </div>
                    {!bookingData.duration && <p className="mt-2 text-xs text-rose-600">예상 소요 시간을 선택해 주세요.</p>}
                  </div>
                </div>

                {isPageMode ? (
                  <Card className="border-gray-200 bg-gray-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">확정된 경로</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p><span className="text-gray-500">출발지:</span> <span className="font-medium text-gray-900">{bookingData.departure || '-'}</span></p>
                      <p><span className="text-gray-500">도착지:</span> <span className="font-medium text-gray-900">{bookingData.destination || '-'}</span></p>
                      <p><span className="text-gray-500">경유지:</span> <span className="font-medium text-gray-900">{bookingData.selectedSpots?.length ? bookingData.selectedSpots.join(', ') : '없음'}</span></p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="departure">출발지</Label>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => requestMapSelectionMode('departure')}>
                            지도에서 선택
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestMapSelectionMode('departure')}
                          className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        >
                          {bookingData.departure || '출발지를 선택해 주세요'}
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {popularDepartureChips.map((chip) => (
                            <Button
                              key={chip}
                              type="button"
                              variant={bookingData.departure === chip ? 'default' : 'outline'}
                              size="sm"
                              className={bookingData.departure === chip ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                              onClick={() => handleInputChange('departure', chip)}
                            >
                              {chip}
                            </Button>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">인기 출발지 칩을 선택하거나, 지도로 직접 고를 수 있어요.</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="destination">도착지</Label>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => requestMapSelectionMode('destination')}>
                            지도에서 선택
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestMapSelectionMode('destination')}
                          className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        >
                          {bookingData.destination || '도착지를 선택해 주세요'}
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {popularDestinationChips.map((chip) => (
                            <Button
                              key={`destination-${chip}`}
                              type="button"
                              variant={bookingData.destination === chip ? 'default' : 'outline'}
                              size="sm"
                              className={bookingData.destination === chip ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                              onClick={() => handleInputChange('destination', chip, COORDS_DICT[chip] || null)}
                            >
                              {chip}
                            </Button>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">직접 입력 대신 장소 검색 또는 지도 선택으로 지정됩니다.</p>
                      </div>
                    </div>

                    {bookingData.course === 'custom' && (
                      <div>
                        <Label>방문하고 싶은 장소 선택</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {popularDestinations.map((dest) => (
                            <Button
                              key={dest}
                              variant={bookingData.selectedSpots?.includes(dest) ? 'default' : 'outline'}
                              size="sm"
                              className="text-xs"
                              onClick={() => handleSpotToggle(dest)}
                            >
                              {dest}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <Label htmlFor="specialRequests" className="mb-1.5 block">특별 요청사항</Label>
                  <Textarea
                    id="specialRequests"
                    placeholder="아이 동반, 휠체어 이용, 특별한 요청사항 등을 입력해주세요"
                    value={bookingData.specialRequests}
                    onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* 지도 영역 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">투어 경로</h3>
                <div className="h-[520px] rounded-lg overflow-hidden border lg:h-[620px]">
                  <MapContainer
                    departure={bookingData.departure}
                    destination={bookingData.destination}
                    spots={bookingData.selectedSpots || []}
                    availableSpots={availableSpots}
                    spotMeta={spotMeta}
                    onPlaceChange={isPageMode ? () => {} : handleInputChange}
                    onSpotAdd={isPageMode ? () => {} : handleSpotAdd}
                    onSpotRemove={isPageMode ? () => {} : handleSpotRemove}
                    hoveredSpot={hoveredSpot}
                    selectionModeRequest={isPageMode ? null : selectionModeRequest}
                    controlsEnabled={!isPageMode}
                    departureCoordinate={placeCoordinates.departure}
                    destinationCoordinate={placeCoordinates.destination}
                  />
                </div>

                {/* 선택된 관광지 목록 */}
                {bookingData.selectedSpots && bookingData.selectedSpots.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>선택된 관광지</Label>
                      <span className="text-xs text-gray-500">{isPageMode ? '확정된 경로 확인용입니다' : '드래그로 순서를 변경할 수 있어요'}</span>
                    </div>
                    <div className="space-y-1">
                      {bookingData.selectedSpots.map((spot, index) => (
                        <div
                          key={index}
                          draggable={!isPageMode}
                          onDragStart={() => !isPageMode && handleSpotDragStart(index)}
                          onDragOver={(event) => !isPageMode && handleSpotDragOver(event, index)}
                          onDrop={() => !isPageMode && handleSpotDrop(index)}
                          onDragEnd={handleSpotDragEnd}
                          className={`flex items-center justify-between bg-gray-50 p-2 rounded hover:bg-gray-100 transition-colors ${isPageMode ? 'cursor-default' : 'cursor-move'} ${dragOverSpotIndex === index ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}
                          onMouseEnter={() => setHoveredSpot(spot)}
                          onMouseLeave={() => setHoveredSpot(null)}
                        >
                          <span className="text-sm">{spot}</span>
                          <Button variant="ghost" size="sm" onClick={() => !isPageMode && handleSpotRemove(spot)} disabled={isPageMode}>
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
              <h3 className="text-lg font-semibold">예약자 정보를 입력하고 내용을 확인해 주세요</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-yellow-200 bg-yellow-50/60">
                  <CardHeader>
                    <CardTitle className="text-base">예약자 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="name">이름 *</Label>
                      <Input
                        id="name"
                        placeholder="홍길동"
                        value={bookingData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="mt-1 border-2 border-yellow-300 bg-white focus-visible:ring-yellow-500"
                      />
                      <p className="mt-1 text-xs text-gray-600">예약 확인을 위해 이름은 필수 입력입니다.</p>
                    </div>
                    <div>
                      <Label htmlFor="phone">연락처</Label>
                      <Input
                        id="phone"
                        placeholder="010-1234-5678"
                        value={bookingData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="mt-1 border-2 border-gray-200 bg-white focus-visible:ring-yellow-500"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="text-base">예약 요약</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>선택 코스:</span>
                      <span className="font-medium">{tourCourses.find(c => c.id === bookingData.course)?.name || '미선택'}</span>
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
                        <span className="font-medium text-right max-w-xs">{bookingData.selectedSpots.join(', ')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <Button variant="outline" onClick={handlePrev} disabled={isPageMode ? currentStep <= 2 : currentStep === 1}>
            이전
          </Button>
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button onClick={handleNext} className="bg-yellow-500 hover:bg-yellow-600" disabled={!canProceedToNext()}>
                다음
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-yellow-500 hover:bg-yellow-600" disabled={!canSubmit()}>
                <CreditCard className="mr-2 h-4 w-4" />
                요금 확인 및 결제
              </Button>
            )}
          </div>
        </div>
      </div>

      <Toaster position="top-right" />

      <Dialog open={showBieiPairWarning} onOpenChange={setShowBieiPairWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출발/도착지 선택 안내</DialogTitle>
            <DialogDescription>
              교통권 문제로 인해 아사히카와 지역이 출발지 또는 도착지에 포함되어야 합니다.
              비에이역에서 2 전역인 지요가오카역에서 출발 또는 도착하실 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowBieiPairWarning(false)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TaxiBooking

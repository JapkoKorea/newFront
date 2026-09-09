'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Clock, MapPin, CreditCard, X, AlertTriangle, Loader2, Minus, Plus } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import MapContainer from '@/components/MapContainer.jsx'
import { COORDS_DICT } from '@/lib/spotCoords.js'
import { useRouter } from 'next/navigation'
import { getLocalDateString } from '@/lib/date.js'
import { getHourlyRate, getDepositKrw, isLastMinuteBooking } from '@/lib/pricing.js'
import { resolveProductSlug } from '@/products/registry.js'
import { detectSeason, tourCourses } from '@/data/tourCourses.js'

// tourCourses 안의 'custom' 은 "장소를 직접 고르는 모드"를 뜻하는 화면 전용
// 항목이다. courses 테이블에는 없으므로 예약에 코스로 보내면 외래키에서 막힌다.
const CUSTOM_COURSE_ID = 'custom'

const BOOKING_DRAFT_STORAGE_KEY = 'booking_draft_v1'
const MINIMUM_HOURS = 2

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 날짜 문자열을 사람이 읽는 형태로. 며칠 남았는지도 함께 알려 준다. */
function describeDate(value, todayStr) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  const picked = new Date(y, m - 1, d)
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const days = Math.round((picked - today) / 86400000)
  const weekday = WEEKDAYS[picked.getDay()]
  const relative = days === 0 ? '오늘' : days === 1 ? '내일' : days === 2 ? '모레' : `${days}일 뒤`
  return { label: `${m}월 ${d}일 (${weekday})`, relative, days }
}

/** 빠른 선택 칩. 오늘부터 며칠 뒤인지로 만든다. */
function shiftDate(todayStr, days) {
  const [y, m, d] = todayStr.split('-').map(Number)
  const next = new Date(y, m - 1, d + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

const TIME_OPTIONS = [
  { value: '09:00', label: '오전 9:00' },
  { value: '10:00', label: '오전 10:00' },
  { value: '11:00', label: '오전 11:00' },
  { value: '13:00', label: '오후 1:00' },
  { value: '14:00', label: '오후 2:00' },
  { value: '15:00', label: '오후 3:00' },
]

// 시간당 요금은 계절(동절기/평시)에 따라 다름 — src/lib/pricing.js 참조.

const TaxiBooking = ({ isOpen = false, onClose, initialDraft = null, displayMode = 'modal', hasPrefill = false }) => {
  const router = useRouter()
  const isPageMode = displayMode === 'page'
  // 상품/코스 페이지를 거쳐 들어온 경우에만 코스 선택 단계를 건너뛴다.
  const skipCourseStep = isPageMode && hasPrefill
  const today = getLocalDateString()
  const flowSteps = [1, 2, 3]
  const stepLabels = skipCourseStep
    ? ['코스 선택(완료)', '예약 입력', '예약자 정보']
    : ['코스 선택', '예약 입력', '예약자 정보']
  const totalSteps = flowSteps.length
  const getInitialBookingData = useCallback(() => ({
    departure: '비에이역',
    destination: '',
    date: '',
    time: '',
    duration: '',
    passengers: '',
    luggage: 'none',
    course: skipCourseStep ? 'custom' : '',
    specialRequests: '',
    name: '',
    phone: '',
    selectedSpots: []
  }), [skipCourseStep])
  const [bookingData, setBookingData] = useState(getInitialBookingData)
  // 어느 상품에서 들어왔는지. 후기가 상품에 붙으려면 예약이 이 값을 들고 있어야 한다.
  const [productSlug, setProductSlug] = useState(null)
  // 상품에서 고르고 들어온 코스. 화면은 장소를 자유 편집하는 모드로 바뀌지만
  // "무슨 코스로 시작했는지"는 예약에 남겨야 한다.
  const [originCourseId, setOriginCourseId] = useState(null)

  const [currentStep, setCurrentStep] = useState(skipCourseStep ? 2 : 1)
  const [hoveredSpot, setHoveredSpot] = useState(null)
  const [showValidation, setShowValidation] = useState(false)
  const [draggedSpotIndex, setDraggedSpotIndex] = useState(null)
  const [dragOverSpotIndex, setDragOverSpotIndex] = useState(null)
  const [selectionModeRequest, setSelectionModeRequest] = useState(null)
  const [showBieiPairWarning, setShowBieiPairWarning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const jumboByLuggageAlertedRef = useRef(false)
  const winter4wdAlertedRef = useRef(false)
  const [placeCoordinates, setPlaceCoordinates] = useState({
    departure: COORDS_DICT['비에이역'] || null,
    destination: null,
  })
  const [customSpotCoordinates, setCustomSpotCoordinates] = useState({})

  const popularDepartureChips = ['비에이역', '지요가오카역', '후라노역', '아사히카와역']
  const popularDestinationChips = ['비에이역', '지요가오카역', '후라노역', '아사히카와역']

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

  const availableSpots = Array.from(new Set([...popularDestinations, ...tourCourses.flatMap((c) => c.spots)]))

  const spotMeta = Object.fromEntries(
    availableSpots.map((spot) => {
      const includedCourses = tourCourses.filter((c) => c.spots.includes(spot)).map((c) => c.name)
      return [spot, { isPopular: popularDestinations.includes(spot), includedCourses, guide: spotGuideData[spot] || null }]
    })
  )

  const shouldBlockBieiPair = (dep, dest) => dep === '비에이역' && dest === '비에이역'

  const passengerCount = Number(bookingData.passengers || 0)
  const hasLuggage = bookingData.luggage !== 'none'
  const isJumboByPassengers = passengerCount >= 5
  const isJumboByLuggage = passengerCount > 0 && passengerCount <= 4 && hasLuggage

  const isWinterMonth = useMemo(() => {
    if (!bookingData.date) return false
    const parsed = new Date(bookingData.date)
    if (Number.isNaN(parsed.getTime())) return false
    const month = parsed.getMonth() + 1
    return month <= 3
  }, [bookingData.date])

  const includesBaegunjang = useMemo(() => {
    const candidates = [bookingData.departure, bookingData.destination, ...(bookingData.selectedSpots || [])]
    return candidates.some((value) => typeof value === 'string' && value.includes('백은장'))
  }, [bookingData.departure, bookingData.destination, bookingData.selectedSpots])

  const requiresWinter4wd = includesBaegunjang && isWinterMonth
  const selectedVehicleType = includesBaegunjang
    ? '사륜구동 차량'
    : (isJumboByPassengers || isJumboByLuggage ? '점보택시' : '일반차량')

  const normalizedHours = useMemo(() => {
    const durationValue = Number(bookingData.duration)
    if (!Number.isFinite(durationValue) || durationValue <= 0) return null
    return Math.max(MINIMUM_HOURS, durationValue)
  }, [bookingData.duration])

  const hourlyRateJpy = getHourlyRate(selectedVehicleType)
  // 당일/전일 예약은 예약금이 올라간다.
  const depositKrw = getDepositKrw(bookingData.date)
  const isLastMinute = isLastMinuteBooking(bookingData.date)

  // 고른 날짜의 요일과 남은 일수. 예약금이 달라지는 경계(전일·당일)를
  // 날짜를 고르는 그 자리에서 알려주기 위해 쓴다.
  const dateInfo = useMemo(
    () => describeDate(bookingData.date, today),
    [bookingData.date, today],
  )

  const dateChips = useMemo(
    () => [
      { label: '내일', value: shiftDate(today, 1) },
      { label: '모레', value: shiftDate(today, 2) },
      { label: '이번 주말', value: shiftDate(today, (6 - new Date(today).getDay() + 7) % 7 || 7) },
      { label: '다음 주', value: shiftDate(today, 7) },
    ],
    [today],
  )

  // 인원 스테퍼 아래에 붙는 한 줄 설명. 5인 이상은 차량이 바뀌므로 그때 알린다.
  const passengerHelper = !bookingData.passengers
    ? '버튼으로 인원을 정해 주세요'
    : passengerCount >= 5
      ? '점보택시가 배정됩니다'
      : passengerCount >= 3
        ? '소규모 팀'
        : passengerCount === 2
          ? '커플 / 친구'
          : '개인 여행'

  const estimatedFareJpy = useMemo(() => {
    if (!normalizedHours) return null
    return normalizedHours * hourlyRateJpy
  }, [hourlyRateJpy, normalizedHours])

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
    const draftSpotCoordinates = initialDraft.spotCoordinates && typeof initialDraft.spotCoordinates === 'object'
      ? initialDraft.spotCoordinates
      : {}

    setBookingData((prev) => ({
      ...getInitialBookingData(),
      course: 'custom',
      departure: nextDeparture,
      destination: safeDestination,
      selectedSpots,
      specialRequests: initialDraft.specialRequests || prev.specialRequests || '',
    }))

    setProductSlug(initialDraft.productSlug || null)
    setOriginCourseId(
      initialDraft.courseId && initialDraft.courseId !== CUSTOM_COURSE_ID ? initialDraft.courseId : null
    )

    setPlaceCoordinates({
      departure: COORDS_DICT[nextDeparture] || null,
      destination: blockedPair ? null : (COORDS_DICT[safeDestination] || null),
    })
    setCustomSpotCoordinates(draftSpotCoordinates)

    const requestedStep = Number.isFinite(initialDraft.startStep) ? initialDraft.startStep : 2
    const nextStep = skipCourseStep ? Math.max(2, Math.min(3, requestedStep)) : Math.max(1, Math.min(3, requestedStep))
    setCurrentStep(nextStep)
    setShowValidation(false)
    if (blockedPair) setShowBieiPairWarning(true)
  }, [displayMode, isOpen, initialDraft, isPageMode, getInitialBookingData])

  useEffect(() => {
    if (!skipCourseStep) return
    setBookingData((prev) => (prev.course ? prev : { ...prev, course: 'custom' }))
    if (currentStep < 2) setCurrentStep(2)
  }, [skipCourseStep, currentStep])

  useEffect(() => {
    if (isJumboByLuggage && !jumboByLuggageAlertedRef.current) {
      alert('4인 이하라도 캐리어가 있으면 점보택시로 배차됩니다.')
      jumboByLuggageAlertedRef.current = true
      return
    }
    if (!isJumboByLuggage) {
      jumboByLuggageAlertedRef.current = false
    }
  }, [isJumboByLuggage])

  useEffect(() => {
    if (requiresWinter4wd && !winter4wdAlertedRef.current) {
      alert('백은장이 경로에 포함되고 1~3월(3월 포함) 일정인 경우 4륜구동 차량으로 진행됩니다.')
      winter4wdAlertedRef.current = true
      return
    }
    if (!requiresWinter4wd) {
      winter4wdAlertedRef.current = false
    }
  }, [requiresWinter4wd])

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
    if (skipCourseStep && step === 1) return []
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

  const handleStepClick = (targetStep) => {
    if (!flowSteps.includes(targetStep) || targetStep === currentStep) return

    // 상품에서 들어온 경우 1단계는 상품 목록으로 되돌아가는 의미다.
    if (skipCourseStep && targetStep === 1) {
      router.push('/products')
      return
    }

    if (targetStep < currentStep) {
      setCurrentStep(targetStep)
      setShowValidation(false)
      return
    }

    if (canProceedToNext()) {
      setCurrentStep(targetStep)
      setShowValidation(false)
      return
    }

    setShowValidation(true)
  }

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
    if (skipCourseStep && currentStep <= 2) return
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
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

    const pickedCourse = tourCourses.find((c) => c.id === bookingData.course)
    // 화면 표기는 고른 코스를 그대로 쓰되, 저장하는 코스 id 는 실제 코스만 남긴다.
    const selectedCourse = pickedCourse?.id === CUSTOM_COURSE_ID ? null : pickedCourse
    const courseIdForRecord = selectedCourse?.id || originCourseId || null
    // 상품에서 코스를 고르고 들어오면 화면 모드는 'custom' 이 된다. 기록에는
    // "커스텀 코스 구성하기"가 아니라 실제로 고른 코스 이름을 남긴다.
    const recordCourseName =
      (pickedCourse?.id === CUSTOM_COURSE_ID
        ? tourCourses.find((c) => c.id === originCourseId)?.name
        : pickedCourse?.name) || pickedCourse?.name
    const desiredCourse = recordCourseName
      ? `${recordCourseName}${bookingData.selectedSpots?.length ? `: ${bookingData.selectedSpots.join(' > ')}` : ''}`
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
      desired_course: `${desiredCourse} [차량:${selectedVehicleType}${requiresWinter4wd ? ', 겨울4WD' : ''}]`,
      source_channel: 'web',
      season: detectSeason(bookingData.date),
      course_id: courseIdForRecord,
      product_slug:
        productSlug || resolveProductSlug({
          courseId: courseIdForRecord,
          season: detectSeason(bookingData.date),
        }),
      is_custom: !selectedCourse,
      selected_spots: (bookingData.selectedSpots || []).map((name) => ({ name })),
    }

    const draft = {
      reservationPayload: payload,
        summary: {
          courseName: recordCourseName || '미선택',
          departure: bookingData.departure,
          destination: bookingData.destination,
          date: bookingData.date,
          time: bookingData.time,
          duration: durationNumber,
          passengers: passengersNumber,
          vehicleType: selectedVehicleType,
          requiresWinter4wd,
          estimatedFareJpy,
          depositKrw: depositKrw,
          selectedSpots: bookingData.selectedSpots || [],
        },
        createdAt: new Date().toISOString(),
      }

    try {
      setIsSubmitting(true)
      sessionStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } catch {
      setIsSubmitting(false)
      alert('예약 정보를 저장하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.')
      return
    }

    if (displayMode === 'modal') {
      onClose?.()
    }
    router.replace('/pricing')
  }

  const visibleStepIndex = Math.max(0, flowSteps.indexOf(currentStep))
  const progressPercent = Math.round(((visibleStepIndex + 1) / totalSteps) * 100)
  const selectedCourse = tourCourses.find(c => c.id === bookingData.course)
  // 상품에서 코스를 골라 들어오면 화면은 자유 편집 모드가 된다. 그래도
  // 요약에는 "커스텀 코스 구성하기"가 아니라 고른 코스 이름이 나와야 한다.
  const originCourse = tourCourses.find(c => c.id === originCourseId)
  const summaryCourseName = (selectedCourse?.id === CUSTOM_COURSE_ID ? originCourse?.name : selectedCourse?.name)
    || selectedCourse?.name
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
            <p className="text-sm text-gray-500 mt-1">{skipCourseStep ? '코스 선택은 완료되었습니다. 남은 2단계를 입력해 주세요.' : '3단계로 간단하게 예약을 완료할 수 있어요.'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="예약 닫기" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
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
                <button
                  type="button"
                  onClick={() => handleStepClick(step)}
                  className="flex min-h-11 items-center gap-2 rounded-full px-1"
                  aria-current={currentStep === step ? 'step' : undefined}
                  title={`${stepLabels[index]} 단계로 이동`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${currentStep >= step ? 'bg-yellow-500 text-white shadow-sm ring-2 ring-yellow-200' : 'bg-gray-200 text-gray-600'}`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-sm transition-colors ${currentStep >= step ? 'font-medium text-yellow-700' : 'text-gray-400'}`}
                  >
                    {stepLabels[index]}
                  </span>
                </button>
                {index < flowSteps.length - 1 && (
                  <div className="mx-2 h-px w-4 bg-gray-300 sm:mx-4 sm:w-12" />
                )}
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
                <p className="font-medium text-gray-900">{summaryCourseName || '아직 선택 전'}</p>
              </div>
              <div>
                <p className="text-gray-500">방문 장소 수</p>
                <p className="font-medium text-gray-900">{bookingData.selectedSpots?.length || 0}곳</p>
              </div>
            </div>
          )}

          {currentStep === 1 && !skipCourseStep && (
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
            <div className="space-y-8">
              {isPageMode && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  경로는 투어 상세에서 확정된 상태입니다. 필요하면 아래에서 바꾸실 수 있어요.
                </div>
              )}

              {/* 1. 경로 — 어디서 출발해 어디서 마칠지를 먼저 정한다.
                  일정보다 먼저 나와야 지도를 보며 정할 수 있다. */}
              <section className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white">1</span>
                  <h3 className="text-lg font-semibold">어디서 출발해 어디서 마칠까요?</h3>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="departure" className="text-sm font-semibold text-gray-900">출발지</Label>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => requestMapSelectionMode('departure')}>
                          지도에서 선택
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestMapSelectionMode('departure')}
                        className={`mt-2 w-full rounded-md border px-3 py-2 text-left text-sm hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                          bookingData.departure ? 'border-gray-300 bg-white text-gray-900' : 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
                        }`}
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
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="destination" className="text-sm font-semibold text-gray-900">도착지</Label>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => requestMapSelectionMode('destination')}>
                          지도에서 선택
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestMapSelectionMode('destination')}
                        className={`mt-2 w-full rounded-md border px-3 py-2 text-left text-sm hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                          bookingData.destination ? 'border-gray-300 bg-white text-gray-900' : 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
                        }`}
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
                    </div>

                    {bookingData.course === 'custom' && (
                      <div className="rounded-xl border border-gray-200 p-4">
                        <Label className="text-sm font-semibold text-gray-900">들르고 싶은 장소</Label>
                        <p className="mt-1 text-xs text-gray-500">고르면 지도에 순서대로 표시됩니다.</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                          {popularDestinations.map((dest) => (
                            <Button
                              key={dest}
                              variant={bookingData.selectedSpots?.includes(dest) ? 'default' : 'outline'}
                              size="sm"
                              className={`text-xs ${bookingData.selectedSpots?.includes(dest) ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
                              onClick={() => handleSpotToggle(dest)}
                            >
                              {dest}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="h-[420px] overflow-hidden rounded-xl border lg:h-[560px]">
                      <MapContainer
                        departure={bookingData.departure}
                        destination={bookingData.destination}
                        spots={bookingData.selectedSpots || []}
                        availableSpots={availableSpots}
                        spotMeta={spotMeta}
                        onPlaceChange={handleInputChange}
                        onSpotAdd={handleSpotAdd}
                        onSpotRemove={handleSpotRemove}
                        hoveredSpot={hoveredSpot}
                        selectionModeRequest={selectionModeRequest}
                        controlsEnabled
                        customSpotCoords={customSpotCoordinates}
                        departureCoordinate={placeCoordinates.departure}
                        destinationCoordinate={placeCoordinates.destination}
                      />
                    </div>

                    {bookingData.selectedSpots && bookingData.selectedSpots.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-gray-900">
                            방문 순서 <span className="font-normal text-gray-500">{bookingData.selectedSpots.length}곳</span>
                          </Label>
                          <span className="text-xs text-gray-500">드래그로 순서를 바꿀 수 있어요</span>
                        </div>
                        <div className="space-y-1">
                          {bookingData.selectedSpots.map((spot, index) => (
                            <div
                              key={index}
                              draggable
                              onDragStart={() => handleSpotDragStart(index)}
                              onDragOver={(event) => handleSpotDragOver(event, index)}
                              onDrop={() => handleSpotDrop(index)}
                              onDragEnd={handleSpotDragEnd}
                              className={`flex cursor-move items-center justify-between rounded bg-gray-50 p-2 transition-colors hover:bg-gray-100 ${dragOverSpotIndex === index ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}
                              onMouseEnter={() => setHoveredSpot(spot)}
                              onMouseLeave={() => setHoveredSpot(null)}
                            >
                              <span className="flex items-center gap-2 text-sm">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-[11px] font-bold text-white">
                                  {index + 1}
                                </span>
                                {spot}
                              </span>
                              <Button variant="ghost" size="sm" onClick={() => handleSpotRemove(spot)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 2. 일정 */}
              <section className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white">2</span>
                  <h3 className="text-lg font-semibold">언제 이용하시나요?</h3>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="date" className="text-sm font-semibold text-gray-900">투어 날짜</Label>
                    {dateInfo ? (
                      <span className="text-xs text-gray-600">
                        {dateInfo.label} · {dateInfo.relative}
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">필수</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {dateChips.map((chip) => (
                      <Button
                        key={chip.label}
                        type="button"
                        size="sm"
                        variant={bookingData.date === chip.value ? 'default' : 'outline'}
                        className={bookingData.date === chip.value ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                        onClick={() => handleInputChange('date', chip.value)}
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>

                  <Input
                    id="date"
                    type="date"
                    min={today}
                    value={bookingData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="mt-2 border-2 border-gray-200 bg-white focus-visible:ring-yellow-500"
                  />

                  {/* 예약금이 달라지는 경계를 고르는 그 자리에서 알린다.
                      결제 화면에 가서야 금액이 다르면 놀란다. */}
                  {isLastMinute && bookingData.date ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      전일·당일 예약이라 예약금이 {depositKrw.toLocaleString()}원으로 적용됩니다.
                    </p>
                  ) : null}
                  {!bookingData.date && <p className="mt-2 text-xs text-rose-600">투어 날짜를 선택해 주세요.</p>}
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-gray-900">투어 시작 시간</Label>
                    {bookingData.time ? null : (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">필수</span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {TIME_OPTIONS.map((option) => {
                      const isSelected = bookingData.time === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInputChange('time', option.value)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            isSelected
                              ? 'border-yellow-500 bg-yellow-100 text-gray-900 shadow-sm'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-yellow-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  {!bookingData.time && <p className="mt-2 text-xs text-rose-600">투어 시작 시간을 선택해 주세요.</p>}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 인원은 버튼 8개 대신 증감으로. 고르는 값이 연속적이라 이쪽이 빠르다. */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <Label className="text-sm font-semibold text-gray-900">탑승 인원</Label>
                    <div className="mt-3 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="인원 줄이기"
                        disabled={passengerCount <= 1}
                        onClick={() => handleInputChange('passengers', String(Math.max(1, passengerCount - 1)))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {bookingData.passengers ? `${passengerCount}명` : '-'}
                        </p>
                        <p className="text-xs text-gray-500">{passengerHelper}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="인원 늘리기"
                        disabled={passengerCount >= 8}
                        onClick={() => handleInputChange('passengers', String(Math.min(8, passengerCount + 1)))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {!bookingData.passengers && <p className="mt-2 text-xs text-rose-600">탑승 인원을 선택해 주세요.</p>}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <Label className="text-sm font-semibold text-gray-900">예상 소요 시간</Label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {durationOptions.map((option) => {
                        const isSelected = bookingData.duration === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleInputChange('duration', option.value)}
                            className={`rounded-lg border px-2 py-2 text-center transition ${
                              isSelected
                                ? 'border-yellow-500 bg-yellow-100 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-yellow-300'
                            }`}
                          >
                            <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                            <p className="text-[11px] text-gray-500">{option.helper}</p>
                          </button>
                        )
                      })}
                    </div>
                    {!bookingData.duration && <p className="mt-2 text-xs text-rose-600">예상 소요 시간을 선택해 주세요.</p>}
                  </div>
                </div>
              </section>

              {/* 3. 이용 조건과 요금 */}
              <section className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white">3</span>
                  <h3 className="text-lg font-semibold">이용 조건과 요금을 확인해 주세요</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-900">캐리어 유무</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={bookingData.luggage === 'none' ? 'default' : 'outline'} className={bookingData.luggage === 'none' ? 'bg-yellow-500 hover:bg-yellow-600' : ''} onClick={() => handleInputChange('luggage', 'none')}>
                          없음
                        </Button>
                        <Button type="button" size="sm" variant={bookingData.luggage === 'has' ? 'default' : 'outline'} className={bookingData.luggage === 'has' ? 'bg-yellow-500 hover:bg-yellow-600' : ''} onClick={() => handleInputChange('luggage', 'has')}>
                          있음
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-3 text-sm">
                      <p><span className="text-gray-500">자동 배차 차량:</span> <span className="font-semibold text-gray-900">{selectedVehicleType}</span></p>
                      {isJumboByPassengers && <p className="mt-1 text-xs text-blue-700">5인 이상은 점보택시가 자동 배정됩니다.</p>}
                      {isJumboByLuggage && <p className="mt-1 text-xs text-blue-700">4인 이하라도 캐리어가 있으면 점보택시가 적용됩니다.</p>}
                    </div>

                    {requiresWinter4wd && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                        백은장이 경로에 포함되고 겨울 시즌(1~3월, 3월 포함)이므로 4륜구동 차량으로 진행됩니다.
                      </div>
                    )}

                    <div>
                      <Label htmlFor="specialRequests" className="mb-1.5 block text-sm font-semibold text-gray-900">특별 요청사항</Label>
                      <Textarea
                        id="specialRequests"
                        placeholder="아이 동반, 휠체어 이용, 특별한 요청사항 등을 입력해주세요"
                        value={bookingData.specialRequests}
                        onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5 text-sm shadow-sm">
                    <p className="text-xs font-semibold tracking-[0.18em] text-yellow-700">요금 계산 안내</p>
                    <p className="text-gray-700">
                      계산식: <span className="font-semibold text-gray-900">시간당 {hourlyRateJpy.toLocaleString()}엔 × {normalizedHours ? `${normalizedHours}시간` : '이용 시간'}</span>
                    </p>
                    <p className="text-gray-700">
                      예상 총 택시비: <span className="font-semibold text-gray-900">{estimatedFareJpy ? `${estimatedFareJpy.toLocaleString()}엔` : '소요 시간 선택 후 확인'}</span>
                    </p>
                    <p className="text-gray-700">
                      예약 요청 시 결제 금액(예약금): <span className="font-semibold text-gray-900">{depositKrw.toLocaleString()}원</span>
                      {isLastMinute && (
                        <span className="ml-1 text-xs font-medium text-amber-700">(당일·전일 예약)</span>
                      )}
                    </p>
                    <div className="rounded-lg border border-yellow-200 bg-white p-3">
                      <p className="text-xs text-yellow-700">최종 비용</p>
                      <p className="text-2xl font-bold text-yellow-800">{depositKrw.toLocaleString()}원</p>
                    </div>
                    <p className="text-xs text-gray-500">※ 최소 2시간 기준으로 계산되며, 현장 결제 금액은 이용 조건에 따라 달라질 수 있습니다.</p>
                  </div>
                </div>
              </section>
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
                    <div className="flex justify-between">
                      <span>배차 차량:</span>
                      <span className="font-medium">{selectedVehicleType}{requiresWinter4wd ? ' (겨울 4WD)' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>예상 택시비:</span>
                      <span className="font-medium">{estimatedFareJpy ? `${estimatedFareJpy.toLocaleString()}엔` : '미선택'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>예약금:</span>
                      <span className="font-medium">{depositKrw.toLocaleString()}원</span>
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
        <div className="flex items-center justify-between gap-3 border-t bg-gray-50 p-4 sm:p-6">
          <Button variant="outline" className="h-11 px-5" onClick={handlePrev} disabled={skipCourseStep ? currentStep <= 2 : currentStep === 1}>
            이전
          </Button>
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button onClick={handleNext} className="h-11 bg-yellow-500 px-8 hover:bg-yellow-600" disabled={!canProceedToNext()}>
                다음
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="h-11 bg-yellow-500 hover:bg-yellow-600" disabled={!canSubmit() || isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />로딩 중...</> : <><CreditCard className="mr-2 h-4 w-4" />요금 확인 및 결제</>}
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

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { X, ChevronLeft, ChevronRight, Navigation, MapPin, Clock, Users, AlertTriangle, Loader2, Luggage } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import MapContainer, { COORDS_DICT } from '@/components/MapContainer.jsx'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

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

const luggageOptions = [
  { value: '0', label: '없음' },
  { value: '1', label: '1개' },
  { value: '2', label: '2개' },
  { value: '3', label: '3개' },
  { value: '4', label: '4개 이상' },
]

const popularChips = ['아사히카와 공항', '아사히카와역', '비에이역', '후라노역']

const totalSteps = 3
const stepLabels = ['경로 설정', '일정·인원', '예약자 정보']

export default function TransferBooking({ isOpen, onClose }) {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  const getInitialData = () => ({
    departure: '',
    destination: '',
    selectedSpots: [],
    date: new Date().toISOString().split('T')[0],
    time: '',
    passengers: '',
    luggage: '0',
    specialRequests: '',
    name: '',
    phone: '',
  })

  const [data, setData] = useState(getInitialData)
  const [currentStep, setCurrentStep] = useState(1)
  const [showValidation, setShowValidation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [selectionModeRequest, setSelectionModeRequest] = useState(null)
  const [placeCoordinates, setPlaceCoordinates] = useState({
    departure: null,
    destination: null,
  })

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleInputChange = (field, value, coords = null) => {
    setData(prev => ({ ...prev, [field]: value }))

    if (field === 'departure' || field === 'destination') {
      let resolved = coords
      if (!resolved && COORDS_DICT[value]) {
        resolved = COORDS_DICT[value]
      }
      setPlaceCoordinates(prev => ({
        ...prev,
        [field]: resolved,
      }))
    }
  }

  const handleSpotAdd = (spotName) => {
    setData(prev => ({
      ...prev,
      selectedSpots: [...(prev.selectedSpots || []), spotName],
    }))
  }

  const handleSpotRemove = (spot) => {
    setData(prev => ({
      ...prev,
      selectedSpots: (prev.selectedSpots || []).filter(s => s !== spot),
    }))
  }

  const requestMapSelectionMode = (mode) => {
    setSelectionModeRequest({ mode, requestedAt: Date.now() })
  }

  const getStepErrors = (step) => {
    if (step === 1) {
      const errors = []
      if (!data.departure) errors.push('출발지를 선택해 주세요.')
      if (!data.destination) errors.push('도착지를 선택해 주세요.')
      return errors
    }
    if (step === 2) {
      const errors = []
      if (!data.date) errors.push('이동 날짜를 선택해 주세요.')
      if (!data.time) errors.push('이동 시간을 선택해 주세요.')
      if (!data.passengers) errors.push('탑승 인원을 선택해 주세요.')
      return errors
    }
    if (step === 3) {
      return data.name ? [] : ['예약자 이름을 입력해 주세요.']
    }
    return []
  }

  const canProceedToNext = () => getStepErrors(currentStep).length === 0

  const handleNext = () => {
    if (currentStep < totalSteps && canProceedToNext()) {
      setShowValidation(false)
      setCurrentStep(currentStep + 1)
      return
    }
    setShowValidation(true)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (!canProceedToNext()) {
      setShowValidation(true)
      return
    }

    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      navigate('/login')
      return
    }

    const passengersNumber = Number(data.passengers)
    const waypointText = data.selectedSpots.length > 0
      ? data.selectedSpots.join(' > ')
      : ''
    const desiredCourse = waypointText
      ? `송영: ${data.departure} → ${waypointText} → ${data.destination}`
      : `송영: ${data.departure} → ${data.destination}`

    const luggageNote = Number(data.luggage) > 0 ? `짐 ${data.luggage}개` : ''
    const notes = [luggageNote, data.specialRequests].filter(Boolean).join(' / ')

    const payload = {
      english_name: data.name,
      contact_number: data.phone || '',
      tour_date: data.date,
      tour_start_time: data.time,
      tour_duration: 1, // 송영은 시간 미정, 최소값
      number_of_people: passengersNumber,
      departure: data.departure,
      destination: data.destination,
      desired_course: notes ? `${desiredCourse} (${notes})` : desiredCourse,
      service_type: 'transfer',
      season: null,
    }

    setSubmitError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservations`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        }
      )

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.detail || `HTTP ${response.status}`)
      }

      setCurrentStep(1)
      setShowValidation(false)
      setData(getInitialData())
      setPlaceCoordinates({ departure: null, destination: null })
      onClose()
      navigate('/reservations')
    } catch (error) {
      setSubmitError(error?.message || '송영 요청에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const progressPercent = Math.round((currentStep / totalSteps) * 100)
  const currentStepErrors = getStepErrors(currentStep)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">송영서비스 요청</h2>
            <p className="text-sm text-gray-500 mt-1">출발지·도착지를 지도에서 지정하면, 기사님이 요금을 안내해 드립니다.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 진행 단계 */}
        <div className="p-6 border-b space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>진행률</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-center">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                <div className={`ml-2 text-sm ${currentStep >= step ? 'text-blue-600' : 'text-gray-400'}`}>
                  {stepLabels[step - 1]}
                </div>
                {step < 3 && <div className="w-12 h-px bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* 검증 오류 */}
          {showValidation && currentStepErrors.length > 0 && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">입력 확인이 필요해요</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-700 space-y-1">
                {currentStepErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {submitError && (
            <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {submitError}
            </div>
          )}

          {/* 요약 배너 (2~3단계) */}
          {currentStep >= 2 && (data.departure || data.destination) && (
            <div className="mb-5 rounded-lg border bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500">출발</p>
                <p className="font-medium text-gray-900">{data.departure || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">도착</p>
                <p className="font-medium text-gray-900">{data.destination || '-'}</p>
              </div>
              {data.selectedSpots.length > 0 && (
                <div>
                  <p className="text-gray-500">경유지</p>
                  <p className="font-medium text-gray-900">{data.selectedSpots.join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* ── 1단계: 경로 설정 (지도) ── */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                {/* 안내 */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-2">
                    <Navigation className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-800 mb-1">송영서비스 안내</h4>
                      <p className="text-sm text-blue-700">
                        출발지와 도착지를 지도에서 선택해 주세요. 경유지가 있으면 추가할 수 있어요.
                        요청 후 기사님이 확인하여 요금을 안내드립니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 출발지 */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label>출발지</Label>
                    <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs"
                      onClick={() => requestMapSelectionMode('departure')}
                    >
                      지도에서 선택
                    </Button>
                  </div>
                  <button type="button"
                    onClick={() => requestMapSelectionMode('departure')}
                    className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {data.departure || '출발지를 선택해 주세요'}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {popularChips.map((chip) => (
                      <Button key={chip} type="button" size="sm"
                        variant={data.departure === chip ? 'default' : 'outline'}
                        className={data.departure === chip ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        onClick={() => handleInputChange('departure', chip)}
                      >
                        {chip}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 도착지 */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label>도착지</Label>
                    <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs"
                      onClick={() => requestMapSelectionMode('destination')}
                    >
                      지도에서 선택
                    </Button>
                  </div>
                  <button type="button"
                    onClick={() => requestMapSelectionMode('destination')}
                    className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {data.destination || '도착지를 선택해 주세요'}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {popularChips.map((chip) => (
                      <Button key={`dest-${chip}`} type="button" size="sm"
                        variant={data.destination === chip ? 'default' : 'outline'}
                        className={data.destination === chip ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        onClick={() => handleInputChange('destination', chip, COORDS_DICT[chip] || null)}
                      >
                        {chip}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 경유지 */}
                {data.selectedSpots.length > 0 && (
                  <div className="space-y-2">
                    <Label>경유지</Label>
                    <div className="space-y-1">
                      {data.selectedSpots.map((spot, index) => (
                        <div key={index}
                          className="flex items-center justify-between bg-gray-50 p-2 rounded hover:bg-gray-100"
                        >
                          <span className="text-sm">{spot}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleSpotRemove(spot)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="button" variant="outline" size="sm"
                  onClick={() => requestMapSelectionMode('spot')}
                >
                  <MapPin className="h-4 w-4 mr-1" /> 경유지 추가 (선택)
                </Button>
              </div>

              {/* 지도 */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">이동 경로</h3>
                <div className="h-[480px] rounded-lg overflow-hidden border lg:h-[560px]">
                  <MapContainer
                    departure={data.departure}
                    destination={data.destination}
                    spots={data.selectedSpots || []}
                    availableSpots={[]}
                    spotMeta={{}}
                    onPlaceChange={handleInputChange}
                    onSpotAdd={handleSpotAdd}
                    onSpotRemove={handleSpotRemove}
                    hoveredSpot={null}
                    selectionModeRequest={selectionModeRequest}
                    departureCoordinate={placeCoordinates.departure}
                    destinationCoordinate={placeCoordinates.destination}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 2단계: 일정·인원 ── */}
          {currentStep === 2 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold">이동 일정을 설정해주세요</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transfer-date">이동 날짜</Label>
                  <Input id="transfer-date" type="date" min={today}
                    value={data.date}
                    onChange={(e) => setData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="transfer-time">이동 시간</Label>
                  <Select value={data.time}
                    onValueChange={(value) => setData(prev => ({ ...prev, time: value }))}
                  >
                    <SelectTrigger id="transfer-time">
                      <SelectValue placeholder="시간 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => {
                        const h = String(6 + i).padStart(2, '0')
                        return <SelectItem key={h} value={`${h}:00`}>{`${h}:00`}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 인원 */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-900">탑승 인원 선택</Label>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">필수</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {passengerOptions.map((option) => (
                    <button key={option.value} type="button"
                      onClick={() => setData(prev => ({ ...prev, passengers: option.value }))}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        data.passengers === option.value
                          ? 'border-blue-500 bg-blue-100 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500">{option.helper}</p>
                    </button>
                  ))}
                </div>
              </div>

              {Number(data.passengers) >= 5 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  5인 이상은 점보 택시가 적용됩니다. 견적에 반영됩니다.
                </div>
              )}

              {/* 짐 개수 */}
              <div>
                <Label>짐 개수 (선택)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {luggageOptions.map((opt) => (
                    <Button key={opt.value} type="button" size="sm"
                      variant={data.luggage === opt.value ? 'default' : 'outline'}
                      className={data.luggage === opt.value ? 'bg-blue-500 hover:bg-blue-600' : ''}
                      onClick={() => setData(prev => ({ ...prev, luggage: opt.value }))}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">큰 캐리어 기준. 견적 산정 시 참고됩니다.</p>
              </div>

              {/* 요청사항 */}
              <div>
                <Label htmlFor="transfer-requests">특별 요청사항 (선택)</Label>
                <Textarea id="transfer-requests"
                  placeholder="예: 유아 동반, 카시트 필요, 숙소 정확한 주소 등"
                  value={data.specialRequests}
                  onChange={(e) => setData(prev => ({ ...prev, specialRequests: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* ── 3단계: 예약자 정보 ── */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold">예약자 정보를 입력해주세요</h3>

              {/* 최종 확인 요약 */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 text-sm">
                <p className="font-semibold text-blue-900">송영 요청 요약</p>
                <div className="grid grid-cols-2 gap-2 text-gray-700">
                  <p>출발: <span className="font-medium">{data.departure}</span></p>
                  <p>도착: <span className="font-medium">{data.destination}</span></p>
                  <p>날짜: <span className="font-medium">{data.date}</span></p>
                  <p>시간: <span className="font-medium">{data.time}</span></p>
                  <p>인원: <span className="font-medium">{data.passengers}명</span></p>
                  {Number(data.luggage) > 0 && (
                    <p>짐: <span className="font-medium">{data.luggage}개</span></p>
                  )}
                </div>
                {data.selectedSpots.length > 0 && (
                  <p className="text-gray-700">경유지: <span className="font-medium">{data.selectedSpots.join(' → ')}</span></p>
                )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">견적 안내</p>
                <p>
                  요청 제출 후 기사님이 경로를 확인하여 요금을 안내드립니다.
                  <strong> 예약 확인 페이지</strong>에서 견적을 확인하고 동의하시면 예약금 결제가 진행됩니다.
                </p>
              </div>

              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/60 p-4 space-y-3">
                <div>
                  <Label htmlFor="transfer-name">이름 *</Label>
                  <Input id="transfer-name" placeholder="홍길동"
                    value={data.name}
                    onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 border-2 border-blue-300 bg-white focus-visible:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-600">예약 확인을 위해 이름은 필수 입력입니다.</p>
                </div>
                <div>
                  <Label htmlFor="transfer-phone">연락처 (선택)</Label>
                  <Input id="transfer-phone" placeholder="+82-10-0000-0000"
                    value={data.phone}
                    onChange={(e) => setData(prev => ({ ...prev, phone: e.target.value }))}
                    className="mt-1 border-2 border-gray-200 bg-white focus-visible:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-between p-6 border-t">
          <Button variant="outline" onClick={currentStep === 1 ? onClose : handlePrev}>
            {currentStep === 1
              ? <><X className="h-4 w-4 mr-2" />취소</>
              : <><ChevronLeft className="h-4 w-4 mr-2" />이전</>
            }
          </Button>
          {currentStep < totalSteps ? (
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleNext}>
              다음 <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />요청 중...</>
                : <>견적 요청 제출</>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

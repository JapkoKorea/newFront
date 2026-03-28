'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { CheckCircle2, Clock3, Coins, Loader2, Route, ShieldCheck, Users, Wallet } from 'lucide-react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

const BOOKING_DRAFT_STORAGE_KEY = 'booking_draft_v1'
const BASE_DEPOSIT_KRW = 15000

const VEHICLE_OPTIONS = [
  {
    id: 'standard',
    type: '일반차량',
    name: '일반 택시',
    capacity: '1-4인',
    hourlyRateJpy: 7350,
    description: '가장 기본적인 선택. 소규모 팀 이동에 적합합니다.',
  },
  {
    id: 'four_wd',
    type: '사륜구동 차량',
    name: '사륜구동 차량',
    capacity: '1-4인',
    hourlyRateJpy: 9000,
    description: '눈길/산길 등 노면 대응력이 필요할 때 추천합니다.',
  },
  {
    id: 'jumbo',
    type: '점보택시',
    name: '점보 택시',
    capacity: '5인 이상',
    hourlyRateJpy: 10500,
    description: '5인 이상 그룹은 점보 택시가 필수입니다.',
  },
]

function PricingDepositPage() {
  const router = useRouter()
  const [bookingDraft, setBookingDraft] = useState(null)
  const [createError, setCreateError] = useState('')
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [proceedAgreement, setProceedAgreement] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      const payload = parsed?.reservationPayload
      if (!payload) return

      setBookingDraft(parsed)
    } catch {
      setBookingDraft(null)
    }
  }, [])

  const isTransfer = bookingDraft?.serviceType === 'transfer'
  const summary = bookingDraft?.summary || {}
  const reservationPayload = bookingDraft?.reservationPayload || {}
  const duration = Number(summary.duration || 0)
  const selectedVehicleType = summary.vehicleType || ''

  const selectedVehicle = VEHICLE_OPTIONS.find((vehicle) => vehicle.type === selectedVehicleType) || VEHICLE_OPTIONS[0]
  const hasValidSummary = useMemo(() => {
    const allowedVehicleTypes = new Set(VEHICLE_OPTIONS.map((vehicle) => vehicle.type))
    const durationNumber = Number(summary.duration)
    const estimatedFareNumber = Number(summary.estimatedFareJpy)
    const depositNumber = Number(summary.depositKrw)

    return (
      allowedVehicleTypes.has(selectedVehicleType)
      && Number.isFinite(durationNumber)
      && durationNumber > 0
      && Number.isFinite(estimatedFareNumber)
      && estimatedFareNumber > 0
      && Number.isFinite(depositNumber)
      && depositNumber > 0
    )
  }, [selectedVehicleType, summary.depositKrw, summary.duration, summary.estimatedFareJpy])

  const calculation = useMemo(() => {
    const normalizedHours = duration > 0 ? Math.max(2, duration) : 0
    const fallbackFare = normalizedHours > 0 ? selectedVehicle.hourlyRateJpy * normalizedHours : null
    const estimatedFareJpy = Number(summary.estimatedFareJpy) || fallbackFare

    return {
      normalizedHours,
      effectiveVehicle: selectedVehicle,
      estimatedFareJpy,
      baseDepositKrw: Number(summary.depositKrw) || BASE_DEPOSIT_KRW,
    }
  }, [duration, selectedVehicle, summary.depositKrw, summary.estimatedFareJpy])

  const handleProceedPayment = async () => {
    if (!bookingDraft?.reservationPayload) {
      setCreateError('예약 정보가 없습니다. 홈에서 예약 정보를 먼저 입력해 주세요.')
      return
    }

    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      router.push('/login')
      return
    }

    try {
      JSON.parse(userRaw)
    } catch {
      setCreateError('로그인 정보를 읽지 못했습니다. 다시 로그인해 주세요.')
      return
    }

    setCreateError('')
    setIsCreatingReservation(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservations`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(bookingDraft.reservationPayload),
        }
      )

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail || `HTTP ${response.status}`)
      }

      const reservationNumber = data?.reservationNumber
      if (!reservationNumber) {
        throw new Error('예약번호를 받지 못했습니다. 다시 시도해 주세요.')
      }

      sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY)
      router.push(`/payments?reservation_number=${encodeURIComponent(reservationNumber)}`)
    } catch (error) {
      setCreateError(error?.message || '예약 생성에 실패했습니다.')
    } finally {
      setIsCreatingReservation(false)
    }
  }

  return (
    <>
    <div className={`min-h-screen bg-gradient-to-b ${isTransfer ? 'from-blue-50/60' : 'from-yellow-50/60'} via-white to-white py-24 px-4`}>
      <div className="max-w-6xl mx-auto space-y-6">
        <section className={`rounded-3xl border ${isTransfer ? 'border-blue-200' : 'border-yellow-200'} bg-white/90 backdrop-blur-sm shadow-sm p-6 md:p-8`}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className={`text-xs tracking-[0.2em] font-semibold ${isTransfer ? 'text-blue-700' : 'text-yellow-700'}`}>
                {isTransfer ? 'TRANSFER SERVICE' : 'PRICING & DEPOSIT'}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-1">
                {isTransfer ? '송영서비스 요금 안내' : '요금 및 예약금 안내'}
              </h1>
              <p className="text-gray-600 mt-3">
                결제 전에 요금 기준을 확인하고, 예약금 결제를 통해 예약 요청을 진행합니다.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/booking')}>이전 단계</Button>
              <Button variant="outline" onClick={() => router.push('/')}>홈으로</Button>
            </div>
          </div>
          {!hasValidSummary && bookingDraft && (
            <p className="text-sm text-rose-700 mt-2">예약 요약 정보가 유효하지 않습니다. 예약 입력 페이지로 돌아가 다시 진행해 주세요.</p>
          )}
        </section>

        {!bookingDraft && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
              <p className="text-amber-900">예약 입력 정보가 없습니다. 예약 입력 페이지에서 정보를 먼저 입력해 주세요.</p>
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/booking')}>예약 입력하러 가기</Button>
            </CardContent>
          </Card>
        )}

        {bookingDraft && !hasValidSummary && (
          <Card className="border-rose-300 bg-rose-50">
            <CardContent className="py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
              <p className="text-rose-900">저장된 예약 요약 정보가 누락되었거나 만료되었습니다. 예약 입력 화면에서 다시 진행해 주세요.</p>
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/booking')}>예약 입력으로 이동</Button>
            </CardContent>
          </Card>
        )}

        {/* 송영서비스는 견적 기반이므로 pricing 페이지를 거치지 않음 — 예약 확인 페이지에서 견적 수락 후 결제 */}

        {/* ── 택시투어 요금 안내 ──────────────────────────── */}
        {!isTransfer && (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">예약 정보 최종 확인</h2>
                <Button variant="outline" size="sm" onClick={() => router.push('/booking')}>예약 정보 수정</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-gray-200 bg-white">
                  <CardContent className="py-5 space-y-1">
                    <p className="text-xs text-gray-500">투어 일정</p>
                    <p className="text-base font-semibold text-gray-900">{bookingDraft?.summary?.date || '-'} {bookingDraft?.summary?.time || ''}</p>
                    <p className="text-xs text-gray-600">예상 {bookingDraft?.summary?.duration || '-'}시간</p>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 bg-white">
                  <CardContent className="py-5 space-y-1">
                    <p className="text-xs text-gray-500">탑승 정보</p>
                    <p className="text-base font-semibold text-gray-900">{summary?.passengers || '-'}명 / {summary?.vehicleType || '-'}</p>
                    <p className="text-xs text-gray-600">코스: {summary?.courseName || '-'}</p>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 bg-white">
                  <CardContent className="py-5 space-y-1">
                    <p className="text-xs text-gray-500">이동 경로</p>
                    <p className="text-sm font-semibold text-gray-900">{bookingDraft?.summary?.departure || '-'} → {bookingDraft?.summary?.destination || '-'}</p>
                    <p className="text-xs text-gray-600">방문지 {bookingDraft?.summary?.selectedSpots?.length || 0}곳</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-amber-900">이용 규칙 안내</h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-amber-900">
                <p className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2">기본 예약금 <span className="font-semibold">15,000원</span> 선결제</p>
                <p className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2">최소 이용시간 <span className="font-semibold">2시간</span></p>
                <p className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2"><span className="font-semibold">5인 이상</span> 점보택시 필수</p>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-yellow-200 bg-white/95">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-yellow-600" />
                    결제 전 확인 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-4">
                    <p className="text-xs tracking-[0.18em] text-yellow-700 font-semibold">최종 결제 금액</p>
                    <p className="mt-1 text-3xl font-bold text-yellow-800">{calculation.baseDepositKrw.toLocaleString()}원</p>
                    <p className="mt-1 text-xs text-gray-600">예약 요청 시 지금 결제되는 금액(예약금)입니다.</p>
                    <p className="mt-2 text-sm text-gray-700">예상 총 택시비: <span className="font-semibold text-gray-900">{calculation.estimatedFareJpy ? `${calculation.estimatedFareJpy.toLocaleString()}엔` : '예약 입력에서 계산된 금액 없음'}</span></p>
                  </div>

                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p className="text-gray-700">예약자 성함: <span className="font-semibold text-gray-900">{reservationPayload.english_name || '-'}</span></p>
                    <p className="text-gray-700">연락처: <span className="font-semibold text-gray-900">{reservationPayload.contact_number || '-'}</span></p>
                    <p className="text-gray-700">투어 날짜: <span className="font-semibold text-gray-900">{summary.date || '-'}</span></p>
                    <p className="text-gray-700">투어 시작 시간: <span className="font-semibold text-gray-900">{summary.time || '-'}</span></p>
                    <p className="text-gray-700">출발지: <span className="font-semibold text-gray-900">{summary.departure || '-'}</span></p>
                    <p className="text-gray-700">도착지: <span className="font-semibold text-gray-900">{summary.destination || '-'}</span></p>
                    <p className="text-gray-700">탑승 인원: <span className="font-semibold text-gray-900">{summary.passengers || '-'}명</span></p>
                    <p className="text-gray-700">배차 차량: <span className="font-semibold text-gray-900">{summary.vehicleType || calculation.effectiveVehicle.name}</span></p>
                    <p className="text-gray-700">예상 이용 시간: <span className="font-semibold text-gray-900">{calculation.normalizedHours ? `${calculation.normalizedHours}시간` : '-'}</span></p>
                    <p className="text-gray-700">예상 택시비: <span className="font-semibold text-gray-900">{calculation.estimatedFareJpy ? `${calculation.estimatedFareJpy.toLocaleString()}엔` : '예약 입력에서 계산된 금액 없음'}</span></p>
                    <p className="text-gray-700">예약금: <span className="font-semibold text-gray-900">{calculation.baseDepositKrw.toLocaleString()}원</span></p>
                    <p className="text-gray-700">요청사항: <span className="font-semibold text-gray-900">{reservationPayload.special_requests || '없음'}</span></p>
                  </div>

                  {summary.selectedSpots?.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                      <p className="text-gray-700">방문지: <span className="font-semibold text-gray-900">{summary.selectedSpots.join(', ')}</span></p>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">* 이 화면은 확인 전용입니다. 금액/차량 변경은 예약 입력 화면에서만 가능합니다.</p>

                  <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proceedAgreement}
                      onChange={(event) => setProceedAgreement(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>위 정보를 확인했으며, 예약금 결제를 진행합니다.</span>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <Button variant="outline" onClick={() => router.push('/booking')}>이전 단계로</Button>
                    <Button
                      className={isTransfer ? 'bg-blue-500 hover:bg-blue-600' : 'bg-yellow-500 hover:bg-yellow-600'}
                      onClick={handleProceedPayment}
                      disabled={!bookingDraft || !hasValidSummary || isCreatingReservation || !proceedAgreement}
                    >
                      {isCreatingReservation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                      예약금 결제 진행
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Coins className="h-5 w-5 text-yellow-600" />
                    차량별 시간당 요금
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {VEHICLE_OPTIONS.map((vehicle) => {
                    const isSelected = calculation.effectiveVehicle.type === vehicle.type
                    return (
                      <div
                        key={vehicle.id}
                        className={`rounded-xl border p-4 transition ${
                          isSelected ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="space-y-2">
                          <div>
                            <p className="font-semibold text-gray-900">{vehicle.name}</p>
                            <p className="text-sm text-gray-600 mt-1">{vehicle.description}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Badge className="border border-yellow-200 bg-yellow-100 text-yellow-800">{vehicle.capacity}</Badge>
                            <span className="font-bold text-base text-gray-900">{vehicle.hourlyRateJpy.toLocaleString()}엔/시간</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Route className="h-5 w-5 text-yellow-600" />
                    예약-결제 진행 흐름
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-700">
                  <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />1. 코스/시간/인원 입력</p>
                  <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-600" />2. 금액/차량 규칙 확인</p>
                  <p className="flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-600" />3. 예약 생성 + 예약금 결제 진행</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" />4. 결제 확인 후 예약 요청 상태 반영</p>
                </CardContent>
              </Card>

              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-yellow-700" />
                    고객 안내 문구(권장)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 space-y-2 leading-relaxed">
                  <p>예약금(15,000원)은 예약 요청 접수를 위한 선결제 금액입니다.</p>
                  <p>차량 요금은 예약 입력 단계에서 확정된 차량 및 이용 시간 기준으로 표시됩니다.</p>
                  <p>이 화면에서는 결제 진행 여부만 선택할 수 있습니다.</p>
                  <p>변경이 필요하면 예약 입력 화면으로 돌아가 수정해 주세요.</p>
                </CardContent>
              </Card>
            </section>
          </>
        )}

        {createError && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="py-4 text-sm text-rose-700">{createError}</CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  )
}

export default PricingDepositPage

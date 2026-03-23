import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { AlertTriangle, Calculator, CheckCircle2, Clock3, Coins, Loader2, Route, ShieldCheck, Users, Wallet } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
const BOOKING_DRAFT_STORAGE_KEY = 'booking_draft_v1'
const BASE_DEPOSIT_KRW = 15000
const MINIMUM_HOURS = 2

const VEHICLE_OPTIONS = [
  {
    id: 'standard',
    name: '일반 택시',
    capacity: '1-4인',
    hourlyRateJpy: 7350,
    description: '가장 기본적인 선택. 소규모 팀 이동에 적합합니다.',
  },
  {
    id: 'four_wd',
    name: '사륜구동 차량',
    capacity: '1-4인',
    hourlyRateJpy: 9000,
    description: '눈길/산길 등 노면 대응력이 필요할 때 추천합니다.',
  },
  {
    id: 'jumbo',
    name: '점보 택시',
    capacity: '5인 이상',
    hourlyRateJpy: 10500,
    description: '5인 이상 그룹은 점보 택시가 필수입니다.',
  },
]

function PricingDepositPage() {
  const navigate = useNavigate()
  const [bookingDraft, setBookingDraft] = useState(null)
  const [createError, setCreateError] = useState('')
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)

  const [passengers, setPassengers] = useState(4)
  const [hours, setHours] = useState(4)
  const [vehicleId, setVehicleId] = useState('standard')

  useEffect(() => {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      const payload = parsed?.reservationPayload
      if (!payload) return

      setBookingDraft(parsed)
      setPassengers(Math.max(1, Number(payload.number_of_people) || 1))
      setHours(Math.max(1, Number(payload.tour_duration) || 1))
    } catch {
      setBookingDraft(null)
    }
  }, [])

  const selectedVehicle = VEHICLE_OPTIONS.find((vehicle) => vehicle.id === vehicleId) || VEHICLE_OPTIONS[0]
  const mustUseJumbo = passengers >= 5

  const calculation = useMemo(() => {
    const normalizedHours = Math.max(MINIMUM_HOURS, Number(hours) || MINIMUM_HOURS)
    const effectiveVehicle = mustUseJumbo
      ? VEHICLE_OPTIONS.find((vehicle) => vehicle.id === 'jumbo') || selectedVehicle
      : selectedVehicle

    const estimatedFareJpy = effectiveVehicle.hourlyRateJpy * normalizedHours

    return {
      normalizedHours,
      effectiveVehicle,
      estimatedFareJpy,
      baseDepositKrw: BASE_DEPOSIT_KRW,
    }
  }, [hours, mustUseJumbo, selectedVehicle])

  const handleProceedPayment = async () => {
    if (!bookingDraft?.reservationPayload) {
      setCreateError('예약 정보가 없습니다. 홈에서 예약 정보를 먼저 입력해 주세요.')
      return
    }

    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      navigate('/login')
      return
    }

    let userId = ''
    try {
      const parsedUser = JSON.parse(userRaw)
      userId = (parsedUser?.user_id || '').trim()
    } catch {
      setCreateError('로그인 정보를 읽지 못했습니다. 다시 로그인해 주세요.')
      return
    }

    if (!userId) {
      setCreateError('사용자 식별 정보가 없습니다. 다시 로그인해 주세요.')
      return
    }

    setCreateError('')
    setIsCreatingReservation(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservations?user_id=${encodeURIComponent(userId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      navigate(`/payments?reservation_number=${encodeURIComponent(reservationNumber)}`)
    } catch (error) {
      setCreateError(error?.message || '예약 생성에 실패했습니다.')
    } finally {
      setIsCreatingReservation(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50/60 via-white to-white py-24 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="rounded-3xl border border-yellow-200 bg-white/90 backdrop-blur-sm shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-yellow-700 font-semibold">PRICING & DEPOSIT</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-1">요금 및 예약금 안내</h1>
              <p className="text-gray-600 mt-3">
                결제 전에 요금 기준을 확인하고, 예약금 결제를 통해 예약 요청을 진행합니다.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>홈으로</Button>
              <Button
                className="bg-yellow-500 hover:bg-yellow-600"
                onClick={handleProceedPayment}
                disabled={!bookingDraft || isCreatingReservation}
              >
                {isCreatingReservation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                예약금 결제 진행
              </Button>
            </div>
          </div>
        </section>

        {!bookingDraft && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
              <p className="text-amber-900">예약 입력 정보가 없습니다. 홈에서 예약 정보를 입력하면 결제 흐름이 이어집니다.</p>
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => navigate('/')}>예약 입력하러 가기</Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">입력 정보 재확인</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>정보 다시 입력</Button>
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
                <p className="text-base font-semibold text-gray-900">{bookingDraft?.summary?.passengers || '-'}명</p>
                <p className="text-xs text-gray-600">코스: {bookingDraft?.summary?.courseName || '-'}</p>
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
          <Card className="lg:col-span-2 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-600" />
                차량별 시간당 요금
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {VEHICLE_OPTIONS.map((vehicle) => {
                const isSelected = calculation.effectiveVehicle.id === vehicle.id
                return (
                  <div
                    key={vehicle.id}
                    className={`rounded-xl border p-4 transition ${
                      isSelected ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{vehicle.name}</p>
                        <p className="text-sm text-gray-600 mt-1">{vehicle.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="border border-yellow-200 bg-yellow-100 text-yellow-800">{vehicle.capacity}</Badge>
                        <span className="font-bold text-lg text-gray-900">{vehicle.hourlyRateJpy.toLocaleString()}엔/시간</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-white/95">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-yellow-600" />
                예상 금액 계산기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-700">인원</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={passengers}
                  onChange={(event) => setPassengers(Math.max(1, Number(event.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">이용 시간</label>
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={hours}
                  onChange={(event) => setHours(Math.max(1, Number(event.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
                {Number(hours) < MINIMUM_HOURS && (
                  <p className="text-xs text-rose-600 mt-1">최소 2시간부터 예약할 수 있어요. 계산은 2시간 기준으로 반영됩니다.</p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-700">차량 선택</label>
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  disabled={mustUseJumbo}
                >
                  {VEHICLE_OPTIONS.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
              </div>

              {mustUseJumbo && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  5인 이상은 점보 택시가 필수라 차량이 자동 적용됩니다.
                </div>
              )}

              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                <p className="text-sm text-gray-700">적용 차량: <span className="font-semibold text-gray-900">{calculation.effectiveVehicle.name}</span></p>
                <p className="text-sm text-gray-700">예상 택시비: <span className="font-semibold text-gray-900">{calculation.estimatedFareJpy.toLocaleString()}엔</span></p>
                <p className="text-sm text-gray-700">예약금: <span className="font-semibold text-gray-900">{calculation.baseDepositKrw.toLocaleString()}원</span></p>
              </div>
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
              <p>차량 요금은 선택 차량의 시간당 요금(엔)과 이용 시간 기준으로 계산됩니다.</p>
              <p>5인 이상은 점보 택시가 필수로 적용됩니다.</p>
              <p>최소 이용 시간은 2시간이며, 2시간 미만 예약은 접수되지 않습니다.</p>
            </CardContent>
          </Card>
        </section>

        {createError && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="py-4 text-sm text-rose-700">{createError}</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default PricingDepositPage

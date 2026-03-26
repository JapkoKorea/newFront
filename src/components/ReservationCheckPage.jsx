'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Calendar, Clock, CreditCard, MapPin, RefreshCcw, UserRound } from 'lucide-react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

const statusLabel = {
  pending: '접수 완료',
  confirmed: '확정',
  cancelled: '취소',
  rejected: '반려',
  completed: '이용 완료',
}

const statusTone = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
}

const paymentLabel = {
  unpaid: '결제 전',
  ready: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
}

const paymentTone = {
  unpaid: 'bg-slate-100 text-slate-700 border-slate-200',
  ready: 'bg-amber-100 text-amber-800 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-rose-100 text-rose-800 border-rose-200',
}

function ReservationCheckPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [reservations, setReservations] = useState([])
  const [selectedReservationNumber, setSelectedReservationNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [canceling, setCanceling] = useState(false)

  const selectedReservation = useMemo(
    () => reservations.find((item) => item.reservation_number === selectedReservationNumber) || reservations[0],
    [reservations, selectedReservationNumber]
  )

  const canCancel = selectedReservation && !['cancelled', 'rejected', 'completed'].includes(selectedReservation.status)

  const loadReservations = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail || `HTTP ${response.status}`)
      }
      const items = data?.reservations || []
      setReservations(items)
      if (items.length > 0) {
        setSelectedReservationNumber(items[0].reservation_number)
      }
    } catch (error) {
      setErrorMessage(error?.message || '예약 정보를 불러오지 못했습니다.')
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      setLoading(false)
      return
    }

    try {
      const user = JSON.parse(userRaw)
      setNickname(user?.nickname || user?.userName || '')
      loadReservations()
    } catch {
      setLoading(false)
      setErrorMessage('로그인 정보를 읽을 수 없습니다. 다시 로그인해 주세요.')
    }
  }, [])

  const handleCancelRequest = async () => {
    if (!selectedReservation || !canCancel) return

    const confirmed = window.confirm('정말 이 예약의 취소 요청을 진행할까요?')
    if (!confirmed) return

    setCanceling(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservations/${encodeURIComponent(selectedReservation.reservation_number)}/cancel`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail || `HTTP ${response.status}`)
      }

      alert('취소 요청이 접수되었습니다.')
      await loadReservations()
    } catch (error) {
      alert(`취소 요청 실패: ${error?.message || error}`)
    } finally {
      setCanceling(false)
    }
  }

  if (!localStorage.getItem('jwt')) {
    return (
      <div className="min-h-screen bg-gray-50 py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-xl text-gray-900">예약 확인을 위해 로그인이 필요해요</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/login')}>
                카카오 로그인
              </Button>
              <Button variant="outline" onClick={() => router.push('/')}>
                홈으로 이동
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50/40 via-white to-white py-24 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-yellow-600 font-semibold">MY RESERVATION</p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">예약 확인</h1>
            {nickname && <p className="text-gray-600 mt-1">{nickname}님, 예약 상태를 한눈에 확인해 보세요.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => loadReservations()}>
              <RefreshCcw className="h-4 w-4 mr-2" />새로고침
            </Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/')}>
              홈으로 이동
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">예약 정보를 불러오는 중...</CardContent>
          </Card>
        ) : errorMessage ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8 text-red-700">{errorMessage}</CardContent>
          </Card>
        ) : reservations.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-gray-600">아직 접수된 예약이 없습니다.</p>
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/')}>택시투어 예약하기</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-base">내 예약 목록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reservations.map((reservation) => (
                  <button
                    key={reservation.reservation_number}
                    onClick={() => setSelectedReservationNumber(reservation.reservation_number)}
                    className={`w-full text-left rounded-lg border p-3 transition ${
                      selectedReservation?.reservation_number === reservation.reservation_number
                        ? 'border-yellow-400 bg-yellow-50'
                        : 'border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <p className="text-xs text-gray-500">예약번호</p>
                    <p className="text-sm font-semibold break-all">{reservation.reservation_number}</p>
                    <p className="text-sm text-gray-600 mt-1">{reservation.tour_date} {String(reservation.tour_start_time).slice(0, 5)}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedReservation && (
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-yellow-200 bg-yellow-50/60">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">예약 상태</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={`border ${statusTone[selectedReservation.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {statusLabel[selectedReservation.status] || selectedReservation.status}
                      </Badge>
                      <Badge className={`border ${paymentTone[selectedReservation.payment_status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {paymentLabel[selectedReservation.payment_status] || selectedReservation.payment_status || '결제 전'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p><span className="text-gray-500">예약번호:</span> <span className="font-medium break-all">{selectedReservation.reservation_number}</span></p>
                    <p><span className="text-gray-500">접수일시:</span> <span className="font-medium">{selectedReservation.created_at?.replace('T', ' ').slice(0, 16) || '-'}</span></p>
                    <p><span className="text-gray-500">결제 상태:</span> <span className="font-medium">{paymentLabel[selectedReservation.payment_status] || selectedReservation.payment_status || '결제 전'}</span></p>
                    <p><span className="text-gray-500">결제 금액:</span> <span className="font-medium">{selectedReservation.payment_amount_krw ? `${Number(selectedReservation.payment_amount_krw).toLocaleString()}원` : '-'}</span></p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-yellow-600" />일정 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p><span className="text-gray-500">투어 날짜:</span> <span className="font-medium">{selectedReservation.tour_date}</span></p>
                    <p><span className="text-gray-500">시작 시간:</span> <span className="font-medium">{String(selectedReservation.tour_start_time).slice(0, 5)}</span></p>
                    <p><span className="text-gray-500">소요 시간:</span> <span className="font-medium">{selectedReservation.tour_duration_hours}시간</span></p>
                    <p><span className="text-gray-500">탑승 인원:</span> <span className="font-medium">{selectedReservation.number_of_people}명</span></p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-yellow-600" />경로/코스</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="text-gray-500">출발지:</span> <span className="font-medium">{selectedReservation.departure}</span></p>
                    <p><span className="text-gray-500">도착지:</span> <span className="font-medium">{selectedReservation.destination}</span></p>
                    <p><span className="text-gray-500">희망 코스:</span> <span className="font-medium">{selectedReservation.desired_course}</span></p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-4 w-4 text-yellow-600" />예약자 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p><span className="text-gray-500">이름:</span> <span className="font-medium">{selectedReservation.english_name}</span></p>
                    <p><span className="text-gray-500">연락처:</span> <span className="font-medium">{selectedReservation.contact_number || '-'}</span></p>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button
                    className="bg-yellow-500 hover:bg-yellow-600"
                    onClick={() => router.push(`/payments?reservation_number=${encodeURIComponent(selectedReservation.reservation_number)}`)}
                    disabled={selectedReservation.payment_status === 'paid' || selectedReservation.status === 'cancelled'}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {selectedReservation.payment_status === 'paid' ? '결제 완료' : '결제하기'}
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/')}>문의하기</Button>
                  <Button variant="outline" onClick={() => router.push('/')}>변경 요청</Button>
                  <Button variant="outline" onClick={handleCancelRequest} disabled={!canCancel || canceling}>
                    {canceling ? '요청 중...' : '취소 요청'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReservationCheckPage

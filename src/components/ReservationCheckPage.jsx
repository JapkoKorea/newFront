'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import ChangeRequestModal from '@/components/ChangeRequestModal.jsx'
import ReviewModal from '@/components/ReviewModal.jsx'
import SessionExpiredDialog from '@/components/SessionExpiredDialog.jsx'
import { fetchReviewEligibility } from '@/lib/reviews.js'
import ChatSupport from '@/components/ChatSupport.jsx'
import { customerStage, paymentLabel } from '@/lib/reservationStatus.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Calendar, Clock, CreditCard, MapPin, RefreshCcw, Star, UserRound } from 'lucide-react'
import { API_BASE_URL, AuthExpiredError, getAuthHeaders, throwIfUnauthorized } from '@/lib/api.js'

function ReservationCheckPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [reservations, setReservations] = useState([])
  const [selectedReservationNumber, setSelectedReservationNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  // 로그인이 풀리면 작은 글씨 대신 화면을 막고 알린다.
  const [authError, setAuthError] = useState('')
  const [canceling, setCanceling] = useState(false)

  const selectedReservation = useMemo(
    () => reservations.find((item) => item.reservation_number === selectedReservationNumber) || reservations[0],
    [reservations, selectedReservationNumber]
  )

  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewEligibility, setReviewEligibility] = useState(null)

  // 후기 작성 자격은 서버가 판정한다(이용 완료 + 미작성). 화면이 다시 계산하지 않는다.
  useEffect(() => {
    setReviewEligibility(null)
    if (!selectedReservation || selectedReservation.status !== 'completed') return
    let alive = true
    fetchReviewEligibility(selectedReservation.reservation_number).then((result) => {
      if (alive) setReviewEligibility(result)
    })
    return () => {
      alive = false
    }
  }, [selectedReservation?.reservation_number, selectedReservation?.status])

  const stage = customerStage(
    selectedReservation?.status,
    selectedReservation?.payment_status,
    {
      channel: selectedReservation?.payment_channel,
      orderNo: selectedReservation?.payment_order_no,
    },
  )

  // 결제 버튼 상태.
  //
  // 결제가 확인됐거나(paid) 예약이 확정·이용 완료된 건은 더 낼 돈이 없다.
  // 확정 예약에 "결제하기"가 활성으로 남아 있으면 이미 낸 돈을 또 낼 수 있다.
  // 취소·반려 건은 결제 자체를 열지 않는다.
  const paymentSettled =
    selectedReservation?.payment_status === 'paid'
    || ['confirmed', 'completed'].includes(selectedReservation?.status)
  const paymentClosed = ['cancelled', 'rejected'].includes(selectedReservation?.status)

  const canCancel = selectedReservation && !['cancelled', 'rejected', 'completed'].includes(selectedReservation.status)

  const loadReservations = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations`, {
        headers: getAuthHeaders(),
      })
      await throwIfUnauthorized(response)
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
      if (error instanceof AuthExpiredError) setAuthError(error.message)
      else setErrorMessage(error?.message || '예약 정보를 불러오지 못했습니다.')
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
      await throwIfUnauthorized(response)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail || `HTTP ${response.status}`)
      }

      alert('취소 요청이 접수되었습니다.')
      await loadReservations()
    } catch (error) {
      if (error instanceof AuthExpiredError) setAuthError(error.message)
      else alert(`취소 요청 실패: ${error?.message || error}`)
    } finally {
      setCanceling(false)
    }
  }

  // 로그인이 풀렸으면 예약 목록을 그리지 않는다. 빈 화면이 비쳐 보이면
  // 예약이 사라진 것처럼 읽힌다.
  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SessionExpiredDialog isOpen message={authError} />
      </div>
    )
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
                    <p className="mt-2 text-xs text-gray-500">탑승 날짜</p>
                    <p className="text-sm text-gray-700">
                      {reservation.tour_date}
                      {reservation.tour_start_time ? ` ${String(reservation.tour_start_time).slice(0, 5)}` : ''}
                    </p>
                    <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs ${customerStage(reservation.status, reservation.payment_status, { channel: reservation.payment_channel, orderNo: reservation.payment_order_no }).tone}`}>
                      {customerStage(reservation.status, reservation.payment_status, { channel: reservation.payment_channel, orderNo: reservation.payment_order_no }).label}
                    </span>
                    {/* 후기를 쓸 수 있다는 것을 눌러보기 전에 알 수 있어야 한다. */}
                    {reservation.status === 'completed' ? (
                      <span className="ml-1 mt-2 inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">
                        <Star className="h-3 w-3" />
                        후기 작성
                      </span>
                    ) : null}
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedReservation && (
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-yellow-200 bg-yellow-50/60">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">예약 상태</CardTitle>
                    <Badge className={`border ${stage.tone}`}>{stage.label}</Badge>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p className="md:col-span-2 text-gray-700">{stage.detail}</p>
                    {reviewEligibility?.canWrite ? (
                      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
                        <span className="text-sm text-yellow-900">{reviewEligibility.notice}</span>
                        <Button
                          size="sm"
                          className="bg-gray-900 hover:bg-gray-800"
                          onClick={() => setIsReviewModalOpen(true)}
                        >
                          <Star className="mr-1 h-4 w-4" />
                          후기 작성
                        </Button>
                      </div>
                    ) : null}
                    {reviewEligibility?.alreadyWritten ? (
                      <p className="md:col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        이미 후기를 남기셨습니다. 감사합니다.
                      </p>
                    ) : null}
                    <p><span className="text-gray-500">예약번호:</span> <span className="font-medium break-all">{selectedReservation.reservation_number}</span></p>
                    <p><span className="text-gray-500">접수일시:</span> <span className="font-medium">{selectedReservation.created_at?.replace('T', ' ').slice(0, 16) || '-'}</span></p>
                    <p><span className="text-gray-500">결제 상태:</span> <span className="font-medium">{paymentLabel(selectedReservation.payment_status)}</span></p>
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
                  {paymentClosed ? null : (
                    <Button
                      className="bg-yellow-500 hover:bg-yellow-600"
                      onClick={() => router.push(`/payments?reservation_number=${encodeURIComponent(selectedReservation.reservation_number)}`)}
                      disabled={paymentSettled}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {paymentSettled ? '결제 완료' : '결제하기'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setIsChangeModalOpen(true)}
                    disabled={!selectedReservation.change_window?.isActive}
                    title={selectedReservation.change_window?.notice || undefined}
                  >
                    변경 요청
                  </Button>
                  {reviewEligibility?.canWrite ? (
                    <Button
                      className="bg-gray-900 hover:bg-gray-800"
                      onClick={() => setIsReviewModalOpen(true)}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      후기 작성
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setIsChatOpen(true)}>
                    문의하기
                  </Button>
                  <Button variant="outline" onClick={handleCancelRequest} disabled={!canCancel || canceling}>
                    {canceling ? '요청 중...' : '취소 요청'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 예약 맥락을 붙여 상담을 연다. 어느 예약 문의인지 대화에 기록된다. */}
      <ChatSupport
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        reservationNumber={selectedReservation?.reservation_number || null}
      />

      <SessionExpiredDialog isOpen={Boolean(authError)} message={authError} />

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        reservation={selectedReservation}
        allowedTags={reviewEligibility?.allowedTags || []}
        onSubmitted={() => {
          alert('후기가 등록되었습니다. 감사합니다.')
          setReviewEligibility((prev) => (prev ? { ...prev, canWrite: false, alreadyWritten: true } : prev))
        }}
      />

      <ChangeRequestModal
        isOpen={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        reservation={selectedReservation}
        onSubmitted={() => {
          setIsChangeModalOpen(false)
          alert('변경 요청이 접수되었습니다. 확인 후 안내드리겠습니다.')
          loadReservations()
        }}
      />
    </div>
  )
}

export default ReservationCheckPage

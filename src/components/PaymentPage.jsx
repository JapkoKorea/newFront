import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { CreditCard, Loader2, MapPin, ShieldCheck, Wallet } from 'lucide-react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

function PaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reservationNumber = searchParams.get('reservation_number') || ''

  const [userId, setUserId] = useState('')
  const [reservation, setReservation] = useState(null)
  const [prepareData, setPrepareData] = useState(null)
  const [widgets, setWidgets] = useState(null)
  const [isRenderingWidget, setIsRenderingWidget] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const amountText = useMemo(() => {
    if (!prepareData?.amount) return '-'
    return `${Number(prepareData.amount).toLocaleString()}원`
  }, [prepareData])

  useEffect(() => {
    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      setLoading(false)
      setErrorMessage('로그인이 필요합니다.')
      return
    }

    try {
      const parsed = JSON.parse(userRaw)
      const id = (parsed?.user_id || '').trim()
      if (!id) {
        setLoading(false)
        setErrorMessage('사용자 정보가 올바르지 않습니다. 다시 로그인해 주세요.')
        return
      }
      setUserId(id)
    } catch {
      setLoading(false)
      setErrorMessage('로그인 정보를 읽을 수 없습니다.')
    }
  }, [])

  useEffect(() => {
    if (!userId || !reservationNumber) return

    const fetchData = async () => {
      setLoading(true)
      setErrorMessage('')
      try {
        const reservationResponse = await fetch(
          `${API_BASE_URL}/api/reservations?reservation_number=${encodeURIComponent(reservationNumber)}`,
          {
            headers: getAuthHeaders(),
          }
        )
        const reservationJson = await reservationResponse.json()
        if (!reservationResponse.ok) {
          throw new Error(reservationJson?.detail || `HTTP ${reservationResponse.status}`)
        }

        const targetReservation = reservationJson?.reservations?.[0]
        if (!targetReservation) {
          throw new Error('예약 정보를 찾을 수 없습니다.')
        }
        setReservation(targetReservation)

        const prepareResponse = await fetch(
          `${API_BASE_URL}/api/payments/prepare?reservation_number=${encodeURIComponent(reservationNumber)}`,
          {
            method: 'POST',
            headers: getAuthHeaders(),
          }
        )
        const prepareJson = await prepareResponse.json()
        if (!prepareResponse.ok) {
          throw new Error(prepareJson?.detail || `HTTP ${prepareResponse.status}`)
        }

        setPrepareData(prepareJson)
      } catch (error) {
        setErrorMessage(error?.message || '결제 준비 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, reservationNumber])

  useEffect(() => {
    if (!prepareData?.client_key || !prepareData?.customer_key) return

    let isActive = true

    const initialize = async () => {
      try {
        const tossPayments = await loadTossPayments(prepareData.client_key)
        const nextWidgets = tossPayments.widgets({ customerKey: prepareData.customer_key })
        if (isActive) {
          setWidgets(nextWidgets)
        }
      } catch {
        if (isActive) {
          setErrorMessage('결제 위젯 초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        }
      }
    }

    initialize()

    return () => {
      isActive = false
    }
  }, [prepareData])

  useEffect(() => {
    if (!widgets || !prepareData) return

    let paymentMethodWidget = null
    let agreementWidget = null
    let isDisposed = false

    const renderWidgets = async () => {
      setIsRenderingWidget(true)
      setIsReady(false)
      try {
        await widgets.setAmount({
          currency: prepareData.currency,
          value: prepareData.amount,
        })

        paymentMethodWidget = await widgets.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT',
        })

        agreementWidget = await widgets.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT',
        })

        if (!isDisposed) {
          setIsReady(true)
        }
      } catch {
        if (!isDisposed) {
          setErrorMessage('결제 UI 렌더링에 실패했습니다. 페이지를 새로고침해 주세요.')
        }
      } finally {
        if (!isDisposed) {
          setIsRenderingWidget(false)
        }
      }
    }

    renderWidgets()

    return () => {
      isDisposed = true
      if (paymentMethodWidget?.destroy) {
        paymentMethodWidget.destroy()
      }
      if (agreementWidget?.destroy) {
        agreementWidget.destroy()
      }
    }
  }, [widgets, prepareData])

  const handleRequestPayment = async () => {
    if (!widgets || !prepareData || !isReady) return

    try {
      await widgets.requestPayment({
        orderId: prepareData.order_id,
        orderName: prepareData.order_name,
        successUrl: prepareData.success_url,
        failUrl: prepareData.fail_url,
        customerName: prepareData.customer_name,
        customerMobilePhone: prepareData.customer_mobile_phone,
      })
    } catch {
      setErrorMessage('결제창을 열지 못했습니다. 팝업 차단 여부를 확인해 주세요.')
    }
  }

  if (!localStorage.getItem('jwt')) {
    return (
      <div className="min-h-screen bg-gray-50 py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-xl text-gray-900">결제를 위해 로그인이 필요해요</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => navigate('/login')}>카카오 로그인</Button>
              <Button variant="outline" onClick={() => navigate('/reservations')}>예약 확인으로</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff6d5_0%,_#ffffff_55%)] py-24 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-yellow-200 bg-white/90 backdrop-blur">
          <CardHeader>
            <p className="text-xs tracking-[0.2em] text-yellow-700">PAYMENT</p>
            <CardTitle className="text-2xl">결제 페이지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {reservationNumber ? (
              <p><span className="text-gray-500">예약번호:</span> <span className="font-medium break-all">{reservationNumber}</span></p>
            ) : (
              <p className="text-rose-600">예약번호가 없습니다. 예약 확인 페이지에서 다시 진입해 주세요.</p>
            )}

            {reservation && (
              <>
                <div className="rounded-lg border border-yellow-100 bg-yellow-50/60 p-3">
                  <p className="text-gray-500">일정</p>
                  <p className="font-medium">{reservation.tour_date} {String(reservation.tour_start_time || '').slice(0, 5)}</p>
                </div>
                <div className="rounded-lg border border-yellow-100 bg-yellow-50/60 p-3">
                  <p className="text-gray-500">경로</p>
                  <p className="font-medium flex items-center gap-2"><MapPin className="h-4 w-4 text-yellow-600" />{reservation.departure} → {reservation.destination}</p>
                </div>
              </>
            )}

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-xs text-yellow-700">최종 결제 금액</p>
              <p className="text-3xl font-bold text-yellow-800 mt-1">{amountText}</p>
              <p className="text-xs text-gray-600 mt-2">카드/계좌이체를 동일한 결제창에서 선택할 수 있습니다.</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              결제 승인 검증은 서버에서 시크릿 키로 처리됩니다.
            </div>

            <Button variant="outline" className="w-full" onClick={() => navigate('/reservations')}>예약 확인으로 돌아가기</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                결제 정보를 준비하는 중입니다...
              </CardContent>
            </Card>
          ) : errorMessage ? (
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="py-10 space-y-4">
                <p className="text-rose-700">{errorMessage}</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/reservations')}>예약 확인으로</Button>
                  <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => window.location.reload()}>다시 시도</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-yellow-200 bg-white/95">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-yellow-600" />결제 수단 선택</CardTitle>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border">Toss Payments</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div id="payment-method" className="min-h-[220px]" />
                  <div id="agreement" />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  className="bg-yellow-500 hover:bg-yellow-600 min-w-44"
                  onClick={handleRequestPayment}
                  disabled={!isReady || isRenderingWidget || !reservationNumber}
                >
                  {isRenderingWidget ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  결제 진행
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PaymentPage

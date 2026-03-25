import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

function PaymentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paymentKey = searchParams.get('paymentKey') || ''
  const orderId = searchParams.get('orderId') || ''
  const amount = Number(searchParams.get('amount') || 0)
  const reservationNumber = searchParams.get('reservation_number') || ''

  const [state, setState] = useState('processing')
  const [message, setMessage] = useState('결제 승인 중입니다...')
  const [paidMethod, setPaidMethod] = useState('')
  const didRequest = useRef(false)

  useEffect(() => {
    if (didRequest.current) return
    didRequest.current = true

    const userRaw = localStorage.getItem('user')
    if (!userRaw) {
      setState('error')
      setMessage('로그인 정보가 없습니다. 예약 확인 페이지에서 다시 시도해 주세요.')
      return
    }

    try {
      JSON.parse(userRaw)
    } catch {
      setState('error')
      setMessage('로그인 정보가 올바르지 않습니다.')
      return
    }

    if (!paymentKey || !orderId || !amount) {
      setState('error')
      setMessage('결제 승인에 필요한 정보가 누락되었습니다.')
      return
    }

    const confirm = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/payments/confirm`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ paymentKey, orderId, amount }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.detail || `HTTP ${response.status}`)
        }
        setPaidMethod(data?.payment?.method || '')
        setState('success')
        setMessage('결제가 정상적으로 완료되었습니다.')
      } catch (error) {
        setState('error')
        setMessage(error?.message || '결제 승인에 실패했습니다. 고객센터에 문의해 주세요.')
      }
    }

    confirm()
  }, [amount, orderId, paymentKey])

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white py-24 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="border-emerald-200">
          <CardHeader>
            <p className="text-xs tracking-[0.2em] text-emerald-700">PAYMENT RESULT</p>
            <CardTitle className="text-2xl flex items-center gap-2">
              {state === 'processing' ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
              결제 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={state === 'error' ? 'text-rose-700' : 'text-gray-700'}>{message}</p>

            <div className="rounded-lg border bg-gray-50 p-4 text-sm space-y-2">
              <p><span className="text-gray-500">주문번호:</span> <span className="font-medium break-all">{orderId || '-'}</span></p>
              <p><span className="text-gray-500">결제금액:</span> <span className="font-medium">{amount ? `${amount.toLocaleString()}원` : '-'}</span></p>
              {reservationNumber && <p><span className="text-gray-500">예약번호:</span> <span className="font-medium break-all">{reservationNumber}</span></p>}
              {paidMethod && (
                <p>
                  <span className="text-gray-500">결제수단:</span>{' '}
                  <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800">{paidMethod}</Badge>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => navigate('/reservations')}>예약 확인으로 이동</Button>
              <Button variant="outline" onClick={() => navigate('/')}>홈으로 이동</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PaymentSuccessPage

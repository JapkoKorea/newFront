import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { AlertTriangle } from 'lucide-react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'

function PaymentFailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || 'PAYMENT_FAILED'
  const message = searchParams.get('message') || '결제 요청이 취소되었거나 실패했습니다.'
  const orderId = searchParams.get('orderId') || ''
  const reservationNumber = searchParams.get('reservation_number') || ''
  const didMark = useRef(false)

  useEffect(() => {
    if (didMark.current || !orderId) return
    didMark.current = true

    const userRaw = localStorage.getItem('user')
    if (!userRaw) return

    try {
      JSON.parse(userRaw)
    } catch {
      return
    }

    const markFailed = async () => {
      await fetch(`${API_BASE_URL}/api/payments/fail`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ orderId, code, message }),
      })
    }

    markFailed()
  }, [code, message, orderId])

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white py-24 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="border-rose-200">
          <CardHeader>
            <p className="text-xs tracking-[0.2em] text-rose-700">PAYMENT RESULT</p>
            <CardTitle className="text-2xl flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-rose-600" />결제 실패</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-rose-700">{message}</p>

            <div className="rounded-lg border bg-rose-50 p-4 text-sm space-y-2">
              <p><span className="text-gray-500">에러 코드:</span> <span className="font-medium">{code}</span></p>
              <p><span className="text-gray-500">주문번호:</span> <span className="font-medium break-all">{orderId || '-'}</span></p>
              {reservationNumber && <p><span className="text-gray-500">예약번호:</span> <span className="font-medium break-all">{reservationNumber}</span></p>}
            </div>

            <div className="flex gap-2">
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => navigate(`/payments?reservation_number=${encodeURIComponent(reservationNumber)}`)}>
                결제 페이지로 돌아가기
              </Button>
              <Button variant="outline" onClick={() => navigate('/reservations')}>예약 확인으로</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PaymentFailPage

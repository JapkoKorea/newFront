'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react'
import { API_BASE_URL, AuthExpiredError, getAuthHeaders, throwIfUnauthorized } from '@/lib/api.js'
import { paymentLabel, paymentTone } from '@/lib/reservationStatus.js'
import { BANK_ACCOUNT, NAVER_STORE_URL, hasBankAccount } from '@/lib/paymentChannels.js'
import { KAKAO_CHANNEL_CHAT, hasKakaoChannel } from '@/lib/kakaoChannel.js'
import ChatSupport from '@/components/ChatSupport.jsx'
import SessionExpiredDialog from '@/components/SessionExpiredDialog.jsx'

/**
 * 결제 안내 화면.
 *
 * 카드 결제(토스)는 심사 전까지 내려 두고 두 가지로 받는다.
 *  - 계좌이체: 계좌와 금액을 보여주고, 입금했다는 알림을 받는다.
 *  - 네이버쇼핑: 스마트스토어 상품 페이지로 보낸다.
 *
 * 입금 확인은 사람이 한다. "입금 완료"를 눌러도 결제 대기까지만 가고,
 * 운영자가 통장을 확인해야 결제 완료가 된다. 예약 상태는 여기서 바뀌지 않는다.
 */
function PaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reservationNumber = searchParams.get('reservation_number') || ''

  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [declaring, setDeclaring] = useState('')
  const [naverOrderNo, setNaverOrderNo] = useState('')
  const [copied, setCopied] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  // 로그인이 풀리면 작은 글씨 대신 화면을 막고 알린다.
  const [authError, setAuthError] = useState('')

  const load = useCallback(async () => {
    if (!reservationNumber) {
      setLoading(false)
      setErrorMessage('예약번호가 없습니다. 예약 확인 화면에서 다시 들어와 주세요.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/payments/transfer-info?reservation_number=${encodeURIComponent(reservationNumber)}`,
        { headers: getAuthHeaders() },
      )
      await throwIfUnauthorized(response)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || `HTTP ${response.status}`)
      setInfo(data)
    } catch (error) {
      if (error instanceof AuthExpiredError) setAuthError(error.message)
      else setErrorMessage(error.message || '예약 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [reservationNumber])

  useEffect(() => {
    if (!localStorage.getItem('jwt')) {
      setLoading(false)
      setAuthError('로그인 후 결제를 진행하실 수 있습니다.')
      return
    }
    load()
  }, [load])

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT.number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErrorMessage('복사에 실패했습니다. 계좌번호를 직접 입력해 주세요.')
    }
  }

  /** 결제했다고 알린다. 어디서 결제했는지(channel)를 함께 보낸다 —
      운영자가 통장을 볼지 스토어를 볼지 알아야 한다. */
  const declarePayment = async (channel) => {
    setDeclaring(channel)
    setErrorMessage('')
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/payments/declare?reservation_number=${encodeURIComponent(reservationNumber)}`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            channel,
            external_order_no: channel === 'naver' ? naverOrderNo.trim() || null : null,
          }),
        },
      )
      await throwIfUnauthorized(response)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail || `HTTP ${response.status}`)
      setInfo((prev) => (prev ? { ...prev, paymentStatus: data.paymentStatus } : prev))
    } catch (error) {
      if (error instanceof AuthExpiredError) setAuthError(error.message)
      else setErrorMessage(error.message || '결제 확인 요청에 실패했습니다.')
    } finally {
      setDeclaring('')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="text-center text-gray-500">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-500" />
          결제 안내를 불러오는 중입니다
        </div>
      </div>
    )
  }

  // 로그인이 풀렸으면 결제 정보를 그리지 않는다. 뒤에 0원짜리 빈 화면과
  // 계좌번호가 비쳐 보이면 무엇을 믿어야 할지 헷갈린다.
  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SessionExpiredDialog isOpen message={authError} />
      </div>
    )
  }

  if (errorMessage && !info) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-24">
        <div className="mx-auto max-w-2xl">
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="space-y-4 py-10">
              <p className="text-rose-700">{errorMessage}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/reservations')}>
                  예약 확인으로
                </Button>
                <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => router.push('/login')}>
                  카카오 로그인
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const reservation = info?.reservation || {}
  const amount = Number(info?.amount || 0)
  const paymentStatus = info?.paymentStatus || 'unpaid'
  const declared = paymentStatus === 'ready'
  const settled = paymentStatus === 'paid'
  // 스마트스토어 주문번호가 있으면 대조할 근거가 있어 바로 진행중으로 안내한다.
  const naverTrusted = info?.paymentChannel === 'naver' && Boolean(info?.paymentOrderNo)
  const accountReady = hasBankAccount()
  // 취소·반려·이용 완료 예약은 더 받을 돈이 없다. 계좌를 보여주면 고객이
  // 송금한 뒤에야 안 되는 예약임을 알게 된다. 서버 판정을 그대로 따른다.
  const canPay = info?.canPay !== false

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-24">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-yellow-700">PAYMENT</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">예약금 결제</h1>
          </div>
          <Badge className={`border ${paymentTone(paymentStatus)}`}>{paymentLabel(paymentStatus)}</Badge>
        </div>

        {/* 예약 정보 — 입금할 때 참고할 내용이 여기 다 있어야 한다 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">예약 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-gray-500">예약번호</p>
              <p className="font-medium break-all text-gray-900">{reservation.reservationNumber}</p>
            </div>
            <div>
              <p className="text-gray-500">예약자</p>
              <p className="font-medium text-gray-900">{reservation.englishName || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">일정</p>
              <p className="font-medium text-gray-900">
                {reservation.tourDate} {reservation.tourStartTime || ''}
              </p>
            </div>
            <div>
              <p className="text-gray-500">인원 / 이용 시간</p>
              <p className="font-medium text-gray-900">
                {reservation.numberOfPeople}명 / {reservation.durationHours}시간
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-gray-500">경로</p>
              <p className="flex items-center gap-1.5 font-medium text-gray-900">
                <MapPin className="h-4 w-4 text-yellow-600" />
                {reservation.departure} → {reservation.destination}
              </p>
            </div>
            {reservation.desiredCourse ? (
              <div className="sm:col-span-2">
                <p className="text-gray-500">코스</p>
                <p className="text-gray-700">{reservation.desiredCourse}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 금액 */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-5">
            <p className="text-xs text-yellow-800">입금하실 금액</p>
            <p className="mt-1 text-3xl font-bold text-yellow-900">{amount.toLocaleString()}원</p>
            <p className="mt-2 text-xs text-gray-600">
              {info?.isLastMinute
                ? '전일 또는 당일 예약이라 예약금이 20,000원으로 적용됩니다.'
                : '예약금입니다. 현지 택시 요금은 투어 당일 기사님께 정산합니다.'}
            </p>
          </CardContent>
        </Card>

        {settled ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="py-5 text-sm text-emerald-800">
              <p className="flex items-center gap-1.5 font-medium">
                <Check className="h-4 w-4" />
                입금이 확인되었습니다.
              </p>
              <p className="mt-1 text-emerald-700">배차를 조율한 뒤 예약을 확정해 드립니다.</p>
            </CardContent>
          </Card>
        ) : null}

        {declared && !settled ? (
          naverTrusted ? (
            <Card className="border-sky-200 bg-sky-50">
              <CardContent className="py-5 text-sm text-sky-900">
                <p className="font-medium">예약이 진행중입니다.</p>
                <p className="mt-1 text-sky-800">
                  주문번호 {info.paymentOrderNo} 로 접수했습니다. 배차를 조율한 뒤 확정해 드립니다.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-5 text-sm text-amber-900">
                <p className="font-medium">입금 확인중입니다.</p>
                <p className="mt-1 text-amber-800">
                  통장을 확인한 뒤 예약을 진행해 드립니다. 확인까지 시간이 걸릴 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )
        ) : null}

        {!canPay ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="py-5 text-sm text-rose-800">
              <p className="font-medium">{info?.blockReason}</p>
              <p className="mt-1 text-rose-700">아래 문의로 연락 주시면 확인해 드리겠습니다.</p>
            </CardContent>
          </Card>
        ) : null}

        {/* 계좌이체 */}
        {canPay ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-5 w-5 text-yellow-600" />
              계좌이체
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {accountReady ? (
              <>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">입금 계좌</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {BANK_ACCOUNT.bank} {BANK_ACCOUNT.number}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">예금주 {BANK_ACCOUNT.holder}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyAccount}>
                      {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                      {copied ? '복사됨' : '복사'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-medium">입금자명을 예약자 성함으로 넣어 주세요.</p>
                  <p className="mt-1 text-blue-800">
                    다르게 입금하시는 경우 문의로 알려 주시면 확인이 빠릅니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                    onClick={() => declarePayment('bank_transfer')}
                    disabled={Boolean(declaring) || declared || settled}
                  >
                    {declaring === 'bank_transfer' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    {settled ? '입금 확인됨' : declared ? '확인 요청됨' : '입금 완료'}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => router.back()}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    취소
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm">
                <p className="font-medium text-gray-700">계좌 정보를 준비 중입니다.</p>
                <p className="mt-1 text-gray-500">문의로 연락 주시면 계좌를 안내드립니다.</p>
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}

        {/* 네이버쇼핑 */}
        {canPay ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-5 w-5 text-green-600" />
              네이버쇼핑에서 결제
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              네이버페이로 결제하시려면 스마트스토어 상품 페이지에서 진행해 주세요.
            </p>
            {NAVER_STORE_URL ? (
              <>
                <Button
                  variant="outline"
                  className="w-full border-green-300 text-green-800 hover:bg-green-50"
                  onClick={() => window.open(NAVER_STORE_URL, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="mr-1 h-4 w-4" />
                  네이버쇼핑으로 이동
                </Button>

                <div className="rounded-xl bg-gray-50 p-3">
                  <label htmlFor="naver-order" className="text-sm font-medium text-gray-800">
                    결제하셨다면 주문번호를 남겨 주세요
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    스마트스토어 주문 내역에서 확인하실 수 있습니다. 없으면 비워 두셔도 됩니다.
                  </p>
                  <input
                    id="naver-order"
                    type="text"
                    value={naverOrderNo}
                    onChange={(event) => setNaverOrderNo(event.target.value)}
                    placeholder="예: 2026090812345678"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-400"
                  />
                  <Button
                    className="mt-2 w-full bg-green-600 hover:bg-green-700"
                    onClick={() => declarePayment('naver')}
                    disabled={Boolean(declaring) || declared || settled}
                  >
                    {declaring === 'naver' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    {settled ? '결제 확인됨' : declared ? '확인 요청됨' : '스마트스토어에서 결제했습니다'}
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                네이버쇼핑 연결 준비 중
              </Button>
            )}
          </CardContent>
        </Card>
        ) : null}

        {/* 문의 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-yellow-600" />
              문의하기
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            {/* 채널이 없으면 버튼을 만들지 않는다. 죽은 링크로 보내는 것보다
                사이트 내 문의로 안내하는 편이 낫다. */}
            {hasKakaoChannel() ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(KAKAO_CHANNEL_CHAT, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                카카오톡 채널로 문의
              </Button>
            ) : null}
            <Button variant="outline" className="flex-1" onClick={() => setIsChatOpen(true)}>
              사이트에서 문의
            </Button>
          </CardContent>
        </Card>

        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <Button variant="ghost" className="w-full" onClick={() => router.push('/reservations')}>
          예약 확인으로 돌아가기
        </Button>
      </div>

      <SessionExpiredDialog isOpen={Boolean(authError)} message={authError} />

      {/* 어느 예약 문의인지 대화에 남는다 */}
      <ChatSupport
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        reservationNumber={reservationNumber || null}
      />
    </div>
  )
}

export default PaymentPage

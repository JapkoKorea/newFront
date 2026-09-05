// 예약 상태의 표시 정보 — 화면 공용.
//
// 고객 화면과 운영자 화면이 같은 라벨을 각자 들고 있어 상태를 추가하면
// 한쪽만 바뀔 수 있었다. 화면에 쓰는 표기는 여기 한 곳에서 가져온다.
//
// 백엔드에도 라벨이 있지만(reservation_admin_service.STATUS_LABELS) 그쪽은
// 서버가 만드는 에러 문장용이라 성격이 다르다. 화면 표기와 합치지 않는다.
//
// 상태 자체의 의미와 전이 규칙은 backend/services/reservation_admin_service.py
// 가 정본이다. 여기는 그것을 사람이 읽는 말로 옮긴 것뿐이다.

export const RESERVATION_STATUS = {
  pending: { label: '접수 완료', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: '확정', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: '반려', tone: 'bg-rose-100 text-rose-800 border-rose-200' },
  cancelled: { label: '취소', tone: 'bg-gray-200 text-gray-700 border-gray-300' },
  completed: { label: '이용 완료', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
}

const FALLBACK_TONE = 'bg-gray-100 text-gray-700 border-gray-200'

/** 상태 코드의 한글 표기. 모르는 값이면 코드를 그대로 보여준다. */
export function statusLabel(status) {
  return RESERVATION_STATUS[status]?.label || status || '-'
}

/** 상태 배지에 쓸 색상 클래스. */
export function statusTone(status) {
  return RESERVATION_STATUS[status]?.tone || FALLBACK_TONE
}

// 결제 상태는 예약 상태와 별개로 관리한다. 결제 승인은 payment_status 만
// 바꾸고 예약 확정은 운영자가 정한다.
export const PAYMENT_STATUS = {
  unpaid: { label: '결제 전', tone: 'bg-gray-100 text-gray-700 border-gray-200' },
  ready: { label: '결제 대기', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  paid: { label: '결제 완료', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  failed: { label: '결제 실패', tone: 'bg-rose-100 text-rose-800 border-rose-200' },
  refunded: { label: '환불 완료', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
  cancelled_no_refund: { label: '취소(환불 없음)', tone: 'bg-gray-200 text-gray-700 border-gray-300' },
}

export function paymentLabel(status) {
  return PAYMENT_STATUS[status]?.label || status || '결제 전'
}

export function paymentTone(status) {
  return PAYMENT_STATUS[status]?.tone || FALLBACK_TONE
}

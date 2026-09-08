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

// 고객에게 보여줄 한 줄 상태.
//
// 예약 상태와 결제 상태를 배지 두 개로 나란히 보여주면 어느 쪽을 봐야 할지
// 모호했다. 고객이 알고 싶은 건 "내 예약이 지금 어디까지 왔나" 하나다.
// 그래서 두 값을 조합해 한 라벨로 만든다.
//
// 데이터는 그대로 두 컬럼이다. 여기서 합치는 것은 표시뿐이며, 결제가 예약
// 상태를 자동으로 바꾸지는 않는다 — 예약 확정은 운영자가 판단한다.
export const CUSTOMER_STAGE = {
  waiting: {
    label: '예약 대기중',
    detail: '예약금 결제를 진행해 주세요.',
    tone: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  checking: {
    label: '입금 확인중',
    detail: '입금 여부를 확인하고 있습니다. 확인되면 예약이 진행됩니다.',
    tone: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  in_progress: {
    label: '예약 진행중',
    detail: '결제가 확인되었습니다. 배차를 조율한 뒤 확정해 드립니다.',
    tone: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  confirmed: {
    label: '예약 확정',
    detail: '배차가 확정되었습니다.',
    tone: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  completed: {
    label: '이용 완료',
    detail: '투어가 끝났습니다. 후기를 남겨 주세요.',
    tone: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  cancelled: {
    label: '예약 취소',
    detail: '취소된 예약입니다.',
    tone: 'bg-gray-200 text-gray-700 border-gray-300',
  },
  rejected: {
    label: '예약 불가',
    detail: '배차가 어려워 진행하지 못했습니다.',
    tone: 'bg-rose-100 text-rose-800 border-rose-200',
  },
}

/**
 * 예약 상태 + 결제 상태 -> 고객이 보는 한 줄 상태.
 *
 * 종결 상태(취소·반려·이용 완료)가 우선한다. 그 외에는 확정 여부를 먼저 보고,
 * 아직이면 결제를 어디까지 했는지로 나눈다.
 *
 * 결제를 알린 직후가 수단에 따라 갈린다.
 *  - 스마트스토어 + 주문번호: 대조할 근거가 있으니 바로 "예약 진행중"
 *  - 그 외(계좌이체, 주문번호 없는 스마트스토어): "입금 확인중"
 *
 * 데이터는 어느 쪽이든 결제 대기(ready)다. 여기서 갈리는 것은 고객에게
 * 보이는 라벨뿐이고, 운영자 화면에는 그대로 미확인으로 남는다.
 *
 * @param {{channel?: string|null, orderNo?: string|null}} [payment]
 */
export function customerStage(status, paymentStatus, payment = {}) {
  if (status === 'cancelled') return CUSTOMER_STAGE.cancelled
  if (status === 'rejected') return CUSTOMER_STAGE.rejected
  if (status === 'completed') return CUSTOMER_STAGE.completed
  if (status === 'confirmed') return CUSTOMER_STAGE.confirmed
  if (paymentStatus === 'paid') return CUSTOMER_STAGE.in_progress
  if (paymentStatus === 'ready') {
    const trusted = payment?.channel === 'naver' && Boolean(payment?.orderNo)
    return trusted ? CUSTOMER_STAGE.in_progress : CUSTOMER_STAGE.checking
  }
  return CUSTOMER_STAGE.waiting
}

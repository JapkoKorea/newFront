'use client'

// 결제 수단 안내.
//
// 카드 결제(토스)는 심사 전까지 내려 두고, 계좌이체와 네이버쇼핑 두 가지로 받는다.
// 계좌번호와 스토어 주소는 저장소에 넣지 않고 환경변수로 받는다. 값이 없으면
// 화면이 "준비 중"으로 표시하고 버튼을 잠근다 — 빈 계좌번호를 보여주는 것보다
// 안내가 준비되지 않았다고 말하는 편이 낫다.
//
// process.env 는 반드시 정적으로 써야 한다. Next 는 process.env.NEXT_PUBLIC_X
// 형태만 빌드 시점에 값으로 바꾼다. process.env[name] 처럼 키를 변수로 넣으면
// 치환되지 않아 브라우저에서 undefined 가 된다.

const clean = (value) => (value || '').trim()

export const BANK_ACCOUNT = {
  bank: clean(process.env.NEXT_PUBLIC_BANK_NAME),
  number: clean(process.env.NEXT_PUBLIC_BANK_ACCOUNT),
  holder: clean(process.env.NEXT_PUBLIC_BANK_HOLDER),
}

export const NAVER_STORE_URL = clean(process.env.NEXT_PUBLIC_NAVER_STORE_URL)

// 카카오 채널은 상품 안내에서도 쓰는 값과 같다.
export const KAKAO_CHANNEL_URL =
  clean(process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL) || 'https://pf.kakao.com/_japko'

export function hasBankAccount() {
  return Boolean(BANK_ACCOUNT.bank && BANK_ACCOUNT.number && BANK_ACCOUNT.holder)
}

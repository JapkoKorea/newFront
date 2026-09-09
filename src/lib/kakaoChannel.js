'use client'

// 카카오톡 채널 주소를 한 곳에서 만든다.
//
// 전에는 'https://pf.kakao.com/_japko' 가 여러 파일에 하드코딩돼 있었는데,
// 그 채널은 존재하지 않아서 "카카오톡 문의" 버튼이 전부 "페이지를 찾을 수
// 없습니다"로 갔다. 채널을 만들면 환경변수 한 줄로 전부 살아나도록 모았다.
//
// 값이 없으면 링크를 만들지 않는다. 죽은 링크로 보내는 것보다 사이트 내
// 문의로 안내하는 편이 낫다.

const clean = (value) => (value || '').trim()

// 채널 공개 ID. 카카오톡 채널 관리자센터의 "채널 URL"에서 _ 뒤 부분이다.
// 예: https://pf.kakao.com/_abcdEF -> _abcdEF
const CHANNEL_ID = clean(process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID)

// 전체 주소를 직접 넣고 싶을 때(단축 URL 등). ID 보다 우선한다.
const CHANNEL_URL_OVERRIDE = clean(process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL)

export const KAKAO_CHANNEL_HOME = CHANNEL_URL_OVERRIDE
  || (CHANNEL_ID ? `https://pf.kakao.com/${CHANNEL_ID}` : '')

// 채널 홈 대신 바로 대화창을 연다. 문의 버튼은 이쪽이 맞다.
export const KAKAO_CHANNEL_CHAT = CHANNEL_URL_OVERRIDE
  || (CHANNEL_ID ? `https://pf.kakao.com/${CHANNEL_ID}/chat` : '')

export function hasKakaoChannel() {
  return Boolean(KAKAO_CHANNEL_HOME)
}

/**
 * 모달 공통 클래스.
 *
 * 폰에서는 화면 아래에 붙는 바텀시트로, sm 이상에서는 가운데 뜨는 모달로 보인다.
 * 한 손으로 쥔 상태에서 화면 위쪽 모서리는 엄지가 닿지 않는다.
 *
 * 높이 단위는 dvh 다. vh 는 모바일 브라우저에서 주소창이 보이든 말든 같은 값이라
 * 주소창이 나와 있을 때 시트 아래쪽이 화면 밖으로 밀려난다.
 *
 * overscroll-contain 이 없으면 시트 안에서 끝까지 스크롤한 뒤 계속 밀 때
 * 뒤쪽 페이지가 같이 움직인다.
 */

/** 배경 겹침 레이어. 여기에 onClick 으로 바깥 클릭 닫기를 건다. */
export const SHEET_OVERLAY =
  'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4'

/** 시트 본체가 통째로 스크롤되는 경우. 폭 제한(max-w-*)은 호출부에서 붙인다. */
export const SHEET_PANEL =
  'max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-xl sm:rounded-2xl'

/** 머리말·바닥글을 고정하고 가운데만 스크롤하는 경우. 안쪽 스크롤 영역에 SHEET_BODY 를 준다. */
export const SHEET_PANEL_FLEX =
  'flex max-h-[88dvh] w-full flex-col overscroll-contain rounded-t-2xl bg-white shadow-xl sm:rounded-2xl'

/** SHEET_PANEL_FLEX 안에서 스크롤되는 영역. */
export const SHEET_BODY = 'flex-1 overflow-y-auto overscroll-contain'

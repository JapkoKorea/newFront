// 날짜 유틸.
//
// new Date().toISOString() 은 UTC 기준이라 한국 시간(UTC+9) 오전 9시 이전에는
// 하루 전 날짜가 나온다. 예약 폼의 기본값과 최소 선택일에 그대로 쓰면
// 새벽에 접속한 사용자에게 과거 날짜가 잡힌다.

/**
 * 사용자의 현지 시간대 기준 YYYY-MM-DD 문자열.
 * @param {Date} [date]
 * @returns {string}
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

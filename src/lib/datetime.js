// 운영자 화면에서 쓰는 시각 표기.
//
// 화면 폭이 좁아 전체 날짜를 늘 보여줄 수는 없다. 오늘 들어온 건은 시각만,
// 그 외에는 날짜까지 보여준다 — 무엇부터 볼지 정하는 데 그거면 충분하다.

export function formatDateTime(value) {
  if (!value) return ''
  const text = String(value).replace('T', ' ')
  return text.slice(0, 16)
}

/** "3분 전", "2시간 전"처럼. 하루가 넘으면 날짜로 돌려준다. */
export function timeAgo(value) {
  if (!value) return ''
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return ''
  const diffMin = Math.floor((Date.now() - then.getTime()) / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return formatDateTime(value).slice(0, 10)
}

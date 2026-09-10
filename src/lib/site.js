// 사이트 정규 도메인. 메타데이터, 사이트맵, robots, JSON-LD 가 공유한다.
//
// 운영 도메인은 japkokorea.com 이고 API 는 api.japkokorea.com 을 쓴다.
// 같은 등록 도메인이라 쿠키가 same-site 로 취급되고, 그래야 나중에
// 리프레시 토큰을 httpOnly 쿠키에 둘 수 있다(Safari 크로스사이트 차단 회피).
//
// 우선순위: NEXT_PUBLIC_SITE_URL > Vercel 배포 URL > 로컬.
// 프리뷰 배포는 도메인이 매번 달라 Vercel 값을 그대로 쓴다.
function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

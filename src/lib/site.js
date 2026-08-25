// 사이트 정규 도메인. 메타데이터, 사이트맵, robots 가 공유한다.
//
// Vercel 배포 시 NEXT_PUBLIC_SITE_URL 을 실제 도메인으로 지정할 것.
// 미지정 시 Vercel 이 주입하는 배포 URL 을 사용하고, 그것도 없으면 로컬 주소로 떨어진다.
function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}

export const SITE_URL = resolveSiteUrl()

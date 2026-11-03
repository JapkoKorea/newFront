/** @type {import('next').NextConfig} */

// API 주소는 배포마다 다르다(로컬 5000, 운영 api.japkokorea.com).
// CSP 의 connect-src 가 이 주소를 허용하지 않으면 모든 API 호출이 막힌다.
const API_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  try {
    return new URL(raw).origin
  } catch {
    return 'http://localhost:5000'
  }
})()

/**
 * 콘텐츠 보안 정책.
 *
 * script-src 에 'unsafe-inline' 이 들어간다. Next 는 하이드레이션 데이터를
 * 인라인 스크립트로 심기 때문에, 이걸 빼려면 요청마다 nonce 를 발급해야 하고
 * 그러면 모든 페이지가 동적 렌더가 된다. 이 사이트는 상품·가이드가 정적
 * 생성이라 그 대가가 너무 크다.
 *
 * 대신 나머지를 좁힌다. 인라인 실행이 뚫려도 (1) 외부 스크립트를 새로
 * 불러올 수 없고 (2) 남의 서버로 데이터를 보낼 수 없고 (3) 폼을 다른 곳으로
 * 보낼 수 없다. XSS 를 막지는 못해도 할 수 있는 일을 크게 줄인다.
 */
// 개발 서버는 소스맵을 eval 로 감싸서 내보낸다. 이걸 막으면 개발 중에 React
// 가 아예 하이드레이션되지 않는다. 프로덕션 빌드에는 eval 이 없으므로
// 운영에서는 빼고, 개발에서만 허용한다.
const DEV = process.env.NODE_ENV !== 'production'

const CSP = [
  "default-src 'self'",
  // 지도는 @react-google-maps/api 가 maps.googleapis.com 에서 받아 온다.
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ''} https://maps.googleapis.com`,
  // Tailwind 런타임과 지도 위젯이 인라인 스타일을 쓴다.
  // 지도 컨트롤은 Google Fonts(Roboto, Google Sans) 스타일시트를 따로 받는다.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // 지도 타일, 카카오 로그인 버튼 이미지, 인라인 데이터 URI.
  "img-src 'self' data: blob: https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com https://developers.kakao.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // 개발 서버는 웹소켓으로 변경 사항을 밀어 준다(HMR).
  // 경로 계산(routes.Route.computeRoutes)은 routes.googleapis.com 으로 XHR 을 보낸다.
  `connect-src 'self' ${API_ORIGIN} https://maps.googleapis.com https://routes.googleapis.com${DEV ? ' ws://localhost:3000' : ''}`,
  // 지도의 스트리트뷰 등이 iframe 을 쓴다.
  "frame-src 'self' https://*.google.com",
  // 우리 페이지를 남이 iframe 에 넣지 못하게(클릭재킹).
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // 폼 전송은 우리 쪽과 카카오 인증만.
  "form-action 'self' https://kauth.kakao.com",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  // https 를 한 번 본 뒤로는 http 로 내려가지 않는다. http 응답에서는 무시된다.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // 서버가 말한 Content-Type 을 브라우저가 멋대로 추측하지 못하게.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // 외부로 나갈 때 경로와 쿼리(예약번호 등)를 넘기지 않는다.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // 쓰지 않는 브라우저 기능은 꺼 둔다.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), interest-cohort=()' },
]

const nextConfig = {
  // 도커 이미지를 가볍게 만들기 위한 독립 실행 번들.
  // Vercel 배포에는 영향이 없다(플랫폼이 자체 처리).
  output: 'standalone',
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 도커 이미지를 가볍게 만들기 위한 독립 실행 번들.
  // Vercel 배포에는 영향이 없다(플랫폼이 자체 처리).
  output: 'standalone',
  images: { unoptimized: true },
}
module.exports = nextConfig

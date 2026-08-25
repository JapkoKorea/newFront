import { SITE_URL } from '@/lib/site.js'

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 개인 예약 정보가 노출되는 경로는 색인에서 제외한다.
      disallow: ['/api/', '/payments/', '/payments', '/reservations', '/login'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

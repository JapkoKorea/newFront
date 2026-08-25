import { listProducts } from '@/products/registry.js'
import { tourCourses } from '@/data/tourCourses.js'
import { guideIndex } from '@/data/guideContent.js'
import { SITE_URL } from '@/lib/site.js'

// 사이트맵은 반드시 웹 도메인에서 서빙되어야 유효하다.
// (백엔드 도메인의 /sitemap.xml 은 검색엔진이 무시한다)
export default function sitemap() {
  const now = new Date()

  const staticPages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/products', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/guide', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/transfer-booking', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/refund', priority: 0.3, changeFrequency: 'yearly' },
  ]

  const productPages = listProducts().map((product) => ({
    path: `/products/${product.slug}`,
    priority: 0.9,
    changeFrequency: 'weekly',
  }))

  const tourPages = tourCourses.map((course) => ({
    path: `/tours/${course.id}`,
    priority: 0.8,
    changeFrequency: 'monthly',
  }))

  const guidePages = guideIndex.map((guide) => ({
    path: `/guide/${guide.slug}`,
    priority: 0.8,
    changeFrequency: 'monthly',
  }))

  return [...staticPages, ...productPages, ...tourPages, ...guidePages].map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}

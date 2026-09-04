// JSON-LD 스키마 빌더 — 페이지 종류별로 사용
//
// 도메인은 src/lib/site.js 한 곳에서 해석한다. 여기에 하드코딩하면
// 배포 도메인이 바뀌었을 때 구조화 데이터만 옛 주소를 가리키게 된다.

import { SITE_URL } from '@/lib/site.js'

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '잽코 택시투어',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['Korean', 'Japanese'],
    },
  }
}

export function buildLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: '잽코 택시투어',
    description: '홋카이도 비에이·후라노 지역 전문 택시투어 서비스',
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      addressRegion: '北海道',
      addressLocality: '美瑛町',
      addressCountry: 'JP',
    },
    areaServed: ['美瑛', '富良野', '旭川'],
    priceRange: '¥¥',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
  }
}

export function buildTourSchema({ course, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: course.name,
    description: course.description,
    url: `${SITE_URL}${url}`,
    touristType: '관광객',
    itinerary: course.spots.map((spot) => ({
      '@type': 'TouristAttraction',
      name: spot,
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: '美瑛町, 北海道',
      },
    })),
    provider: {
      '@type': 'Organization',
      name: '잽코 택시투어',
      url: SITE_URL,
    },
  }
}

export function buildArticleSchema({ title, description, url, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: `${SITE_URL}${url}`,
    dateModified: dateModified ?? new Date().toISOString().split('T')[0],
    publisher: {
      '@type': 'Organization',
      name: '잽코 택시투어',
      url: SITE_URL,
    },
    inLanguage: 'ko',
  }
}

export function buildBreadcrumbSchema(items) {
  // items: [{ name, url }]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  }
}

/**
 * FAQPage 스키마.
 *
 * AI 답변엔진이 가장 잘 인용하는 형식이 명시적인 질문-답변 쌍이다.
 * 화면에 실제로 보이는 문답만 넣어야 한다(구조화 데이터 지침).
 *
 * @param {{q: string, a: string}[]} items
 */
export function buildFaqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

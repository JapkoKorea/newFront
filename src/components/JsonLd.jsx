// JSON-LD 스키마 빌더 — 페이지 종류별로 사용

const SITE_URL = 'https://japko.kr'

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

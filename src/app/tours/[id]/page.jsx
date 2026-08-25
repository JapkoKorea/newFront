import { tourCourses, spotGuideData, SEASON_LABEL, SEASON_MONTHS, fixedRouteProfiles } from '@/data/tourCourses.js'
import { fetchCourse } from '@/lib/api.js'
import { notFound } from 'next/navigation'
import TourDetailClient from '@/components/TourDetailClient.jsx'

export const dynamic = 'force-dynamic'

async function loadCourse(id) {
  try {
    const course = await fetchCourse(id)
    if (course) return course
  } catch {
    // 백엔드 비가용 시 정적 데이터로 폴백
  }
  return tourCourses.find((item) => item.id === id) || null
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const course = await loadCourse(id)
  if (!course) return {}
  return {
    title: `${course.name}`,
    description: `${course.name} — ${course.description} 출발: ${course.departure || '협의'}, 소요시간: ${course.duration}`,
  }
}

export default async function TourDetailPage({ params }) {
  const { id } = await params
  const course = await loadCourse(id)
  if (!course) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TouristTrip',
            name: course.name,
            description: course.description,
            itinerary: course.spots.map((spot) => ({
              '@type': 'TouristAttraction',
              name: spot,
              containedInPlace: { '@type': 'AdministrativeArea', name: '美瑛町, 北海道' },
            })),
            provider: { '@type': 'Organization', name: '잽코 택시투어' },
          }),
        }}
      />
      <TourDetailClient
        course={course}
        spotGuideData={spotGuideData}
        fixedRouteProfile={fixedRouteProfiles[course.id] || null}
        seasonLabel={SEASON_LABEL}
        seasonMonths={SEASON_MONTHS}
      />
    </>
  )
}

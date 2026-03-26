import { tourCourses, spotGuideData, SEASON_LABEL, SEASON_MONTHS } from '@/data/tourCourses.js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock, MapPin, ChevronRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import TourRouteEditor from '@/components/TourRouteEditor.jsx'

export async function generateStaticParams() {
  return tourCourses.map((c) => ({ id: c.id }))
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const course = tourCourses.find((c) => c.id === id)
  if (!course) return {}
  return {
    title: `${course.name} | 잽코 택시투어`,
    description: `${course.name} — ${course.description} 출발: ${course.departure || '협의'}, 소요시간: ${course.duration}`,
  }
}

const SEASON_COLOR = {
  winter: 'bg-blue-100 text-blue-800',
  summer: 'bg-pink-100 text-pink-800',
  all_season: 'bg-green-100 text-green-800',
}

export default async function TourDetailPage({ params }) {
  const { id } = await params
  const course = tourCourses.find((c) => c.id === id)
  if (!course) notFound()

  return (
    <div className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-yellow-500">홈</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/tours" className="hover:text-yellow-500">투어 코스</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900">{course.name}</span>
        </nav>

        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex gap-2 mb-3 flex-wrap">
            {course.season.map((s) => (
              <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEASON_COLOR[s]}`}>
                {SEASON_LABEL[s]} ({SEASON_MONTHS[s]})
              </span>
            ))}
            {course.badge && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">
                {course.badge}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{course.name}</h1>
          <p className="text-lg text-gray-600">{course.description}</p>
        </div>

        {/* 기본 정보 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 p-5 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-500 mb-1">소요 시간</p>
            <p className="font-semibold text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-500" />{course.duration}
            </p>
          </div>
          {course.departure && (
            <div>
              <p className="text-xs text-gray-500 mb-1">출발지</p>
              <p className="font-semibold text-gray-900 flex items-center gap-1">
                <MapPin className="h-4 w-4 text-yellow-500" />{course.departure}
              </p>
            </div>
          )}
          {course.destination && (
            <div>
              <p className="text-xs text-gray-500 mb-1">도착지</p>
              <p className="font-semibold text-gray-900 flex items-center gap-1">
                <MapPin className="h-4 w-4 text-yellow-500" />{course.destination}
              </p>
            </div>
          )}
        </div>

        {/* JSON-LD */}
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

        {/* 인터랙티브 루트 에디터 (지도 + 명소 순서 변경) */}
        {course.spots.length > 0 && (
          <TourRouteEditor
            initialDeparture={course.departure}
            initialDestination={course.destination}
            initialSpots={course.spots}
            spotGuideData={spotGuideData}
          />
        )}

        {/* 포함/불포함 */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 bg-green-50 rounded-xl">
            <h2 className="font-bold text-green-800 mb-3">포함 사항</h2>
            <ul className="space-y-2 text-sm text-green-700">
              <li>✓ 전문 기사/가이드 동행</li>
              <li>✓ 차량 이용 (에어컨/히터)</li>
              <li>✓ 코스 내 이동 일체</li>
              <li>✓ 한국어 대응</li>
            </ul>
          </div>
          <div className="p-5 bg-gray-50 rounded-xl">
            <h2 className="font-bold text-gray-800 mb-3">불포함 사항</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✗ 명소 입장료</li>
              <li>✗ 식사</li>
              <li>✗ 개인 여행자 보험</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" size="lg">
            <Link href="/pricing">요금 확인 및 예약</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/tours"><ArrowLeft className="h-4 w-4 mr-2" />다른 코스 보기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

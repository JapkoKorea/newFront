'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, MapPin, ChevronRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import TourRouteEditor from '@/components/TourRouteEditor.jsx'
import { saveTourBookingPrefill } from '@/lib/bookingPrefill.js'

const SEASON_COLOR = {
  winter: 'bg-blue-100 text-blue-800',
  summer: 'bg-pink-100 text-pink-800',
  all_season: 'bg-green-100 text-green-800',
}

function getInitialRouteState(course, fixedRouteProfile) {
  if (fixedRouteProfile) {
    return {
      departure: fixedRouteProfile.departure || course.departure || '',
      destination: fixedRouteProfile.destination || course.destination || '',
      spots: fixedRouteProfile.spots || course.spots || [],
    }
  }
  return {
    departure: course.departure || '',
    destination: course.destination || '',
    spots: course.spots || [],
  }
}

export default function TourDetailClient({ course, spotGuideData, fixedRouteProfile, seasonLabel, seasonMonths }) {
  const router = useRouter()
  const [routeDraft, setRouteDraft] = useState(() => getInitialRouteState(course, fixedRouteProfile))

  const bookingPrefill = useMemo(() => ({
    departure: routeDraft.departure,
    destination: routeDraft.destination,
    selectedSpots: routeDraft.spots,
    spotCoordinates: routeDraft.spotCoordinates || {},
    startStep: 2,
    courseName: course.name,
    courseId: course.id,
  }), [routeDraft, course.name, course.id])

  const startBookingFlow = () => {
    saveTourBookingPrefill(bookingPrefill)
    router.push('/booking?from=product')
  }

  return (
    <div className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-yellow-500">홈</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/tours" className="hover:text-yellow-500">투어 코스</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900">{course.name}</span>
        </nav>

        <div className="mb-8">
          <div className="flex gap-2 mb-3 flex-wrap">
            {course.season.map((season) => (
              <span key={season} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEASON_COLOR[season]}`}>
                {seasonLabel[season]} ({seasonMonths[season]})
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

        <div className="mb-8 rounded-xl border bg-gray-50 p-4 space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>예약 진행 단계</span>
            <span>1 / 3</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500" style={{ width: '34%' }} />
          </div>
          <div className="flex items-center justify-center gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-yellow-700 font-medium">
              <span className="w-7 h-7 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold">1</span>
              <span>코스 확인/설정</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className="flex items-center gap-2 text-gray-400">
              <span className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold">2</span>
              <span>예약 입력</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className="flex items-center gap-2 text-gray-400">
              <span className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold">3</span>
              <span>예약 확인</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 p-5 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-500 mb-1">소요 시간</p>
            <p className="font-semibold text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-500" />{course.duration}
            </p>
          </div>
          {routeDraft.departure && (
            <div>
              <p className="text-xs text-gray-500 mb-1">출발지</p>
              <p className="font-semibold text-gray-900 flex items-center gap-1">
                <MapPin className="h-4 w-4 text-yellow-500" />{routeDraft.departure}
              </p>
            </div>
          )}
          {routeDraft.destination && (
            <div>
              <p className="text-xs text-gray-500 mb-1">도착지</p>
              <p className="font-semibold text-gray-900 flex items-center gap-1">
                <MapPin className="h-4 w-4 text-yellow-500" />{routeDraft.destination}
              </p>
            </div>
          )}
        </div>

        {course.spots.length > 0 && (
          <TourRouteEditor
            courseId={course.id}
            initialDeparture={course.departure}
            initialDestination={course.destination}
            initialSpots={course.spots}
            fixedRouteProfile={fixedRouteProfile}
            spotGuideData={spotGuideData}
            onRouteStateChange={setRouteDraft}
          />
        )}

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

        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" size="lg" onClick={startBookingFlow}>
            예약 입력 페이지로 이동
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/tours"><ArrowLeft className="h-4 w-4 mr-2" />다른 코스 보기</Link>
          </Button>
        </div>
      </div>

    </div>
  )
}

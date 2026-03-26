'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, MapPin, ChevronRight } from 'lucide-react'
import { SEASON_LABEL, SEASON_MONTHS } from '@/data/tourCourses.js'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'

const SEASON_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'winter', label: '❄️ 겨울' },
  { value: 'summer', label: '🌸 여름' },
  { value: 'all_season', label: '🍂 사계절' },
]

const SEASON_COLOR = {
  winter: 'bg-blue-100 text-blue-800',
  summer: 'bg-pink-100 text-pink-800',
  all_season: 'bg-green-100 text-green-800',
}

export default function ToursPageClient({ courses }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? courses
    : courses.filter((c) => c.season.includes(filter))

  return (
    <div className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-yellow-500 font-medium mb-2">투어 코스</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">비에이·후라노 택시투어 코스</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            겨울 설경 드라이브부터 여름 라벤더 로드까지. 목적과 시즌에 맞는 코스를 선택하세요.
          </p>
        </div>

        {/* 시즌 필터 */}
        <div className="flex gap-2 justify-center flex-wrap mb-8">
          {SEASON_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                filter === opt.value
                  ? 'bg-yellow-400 text-white border-yellow-400'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-yellow-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 코스 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((course) => (
            <Link
              key={course.id}
              href={`/tours/${course.id}`}
              className="group block border rounded-xl p-6 hover:shadow-md hover:border-yellow-300 transition-all bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2 flex-wrap">
                  {course.season.map((s) => (
                    <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEASON_COLOR[s]}`}>
                      {SEASON_LABEL[s]}
                    </span>
                  ))}
                </div>
                {course.badge && <Badge variant="secondary" className="text-xs shrink-0">{course.badge}</Badge>}
              </div>

              <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors">
                {course.name}
              </h2>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{course.description}</p>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{course.duration}</span>
                {course.departure && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{course.departure}</span>}
              </div>

              {course.spots.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {course.spots.slice(0, 3).map((spot) => (
                    <span key={spot} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{spot}</span>
                  ))}
                  {course.spots.length > 3 && <span className="text-xs text-gray-400">+{course.spots.length - 3}곳</span>}
                </div>
              )}

              <div className="flex justify-end mt-4">
                <span className="text-yellow-500 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  자세히 보기 <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center bg-yellow-50 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">원하는 코스가 없으신가요?</h2>
          <p className="text-gray-600 mb-4">출발지, 방문 장소, 시간을 직접 구성하는 커스텀 코스도 가능합니다.</p>
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Link href="/tours/custom">커스텀 코스 문의하기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

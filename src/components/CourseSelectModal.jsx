'use client'

import { X, Clock, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

/**
 * 상품에 속한 코스 중 하나를 고르는 모달.
 * 고르면 onSelect(course) 로 넘겨 예약 흐름을 시작한다.
 */
export default function CourseSelectModal({ isOpen, onClose, productName, courses, onSelect }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">코스 선택</h2>
            <p className="mt-1 text-sm text-gray-500">
              {productName}에서 진행할 코스를 골라 주세요. 예약 중에도 바꿀 수 있습니다.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="닫기">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelect(course)}
                className="w-full rounded-xl border-2 border-gray-200 p-4 text-left transition hover:border-yellow-400 hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900">{course.name}</p>
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-600">
                    <Clock className="h-3.5 w-3.5" />
                    {course.duration}
                  </span>
                </div>

                <p className="mt-1.5 text-sm text-gray-600">{course.description}</p>

                <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {course.departure} 출발 · {course.destination} 도착
                </p>

                {course.spots.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {course.spots.map((spot) => (
                      <span
                        key={spot}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
                      >
                        {spot}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t px-6 py-4">
          <p className="text-center text-xs text-gray-400">
            원하는 코스가 없으면 예약 화면에서 직접 경로를 만들 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}

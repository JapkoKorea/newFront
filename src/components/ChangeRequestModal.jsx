'use client'

import { useEffect, useState } from 'react'
import { X, CalendarDays, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { API_BASE_URL, getAuthHeaders } from '@/lib/api.js'
import { getLocalDateString } from '@/lib/date.js'

const TIME_OPTIONS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']

/**
 * 예약 변경 요청 모달.
 *
 * 어떤 항목을 바꿀 수 있는지는 서버 판정(reservation.change_window)을 그대로 따른다.
 * 화면이 날짜 계산을 다시 하면 서버 규칙과 어긋나므로 여기서는 판정하지 않는다.
 */
export default function ChangeRequestModal({ isOpen, onClose, reservation, onSubmitted }) {
  const [tourDate, setTourDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ESC 로 닫기. 훅은 조건부 return 앞에 있어야 한다.
  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen || !reservation) return null

  const window_ = reservation.change_window || {}
  const canDate = Boolean(window_.canChangeDate)
  const canTime = Boolean(window_.canChangeTime)
  const nothingPicked = !tourDate && !startTime

  const currentDate = String(reservation.tour_date || '').slice(0, 10)
  const currentTime = String(reservation.tour_start_time || '').slice(0, 5)

  const reset = () => {
    setTourDate('')
    setStartTime('')
    setReason('')
    setError('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservations/${encodeURIComponent(reservation.reservation_number)}/change-requests`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            tour_date: tourDate || null,
            tour_start_time: startTime || null,
            reason: reason.trim() || null,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || `요청에 실패했습니다 (${response.status})`)
      }
      reset()
      onSubmitted?.(data)
    } catch (err) {
      setError(err?.message || '요청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">예약 변경 요청</h2>
            <p className="mt-1 text-sm text-gray-500">
              바꾸고 싶은 항목만 입력해 주세요. 접수 후 배차를 확인해 안내드립니다.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={close} aria-label="닫기">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="rounded-lg bg-gray-50 p-4 text-sm">
            <p className="text-gray-500">현재 일정</p>
            <p className="mt-1 font-semibold text-gray-900">
              {currentDate} {currentTime}
            </p>
            {window_.notice ? (
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{window_.notice}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="change-date" className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              희망 날짜
              {!canDate ? <span className="text-xs font-normal text-gray-500">— 변경 기한이 지났습니다</span> : null}
            </label>
            <input
              id="change-date"
              type="date"
              value={tourDate}
              min={getLocalDateString()}
              disabled={!canDate}
              onChange={(event) => setTourDate(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>

          <div>
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
              <Clock className="h-4 w-4 text-gray-500" />
              희망 시작 시간
              {!canTime ? <span className="text-xs font-normal text-gray-500">— 변경 기한이 지났습니다</span> : null}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={!canTime}
                  onClick={() => setStartTime(startTime === option ? '' : option)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${
                    startTime === option
                      ? 'border-yellow-500 bg-yellow-50 font-medium text-yellow-800'
                      : 'border-gray-300 text-gray-700 hover:border-yellow-400'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="change-reason" className="text-sm font-medium text-gray-900">
              사유 <span className="text-xs font-normal text-gray-500">(선택)</span>
            </label>
            <textarea
              id="change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="항공편 변경, 일정 조정 등 알려주실 내용이 있으면 적어 주세요."
              className="mt-2 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-xs text-gray-500">변경은 접수 후 확정됩니다.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={submitting}>취소</Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600"
              onClick={submit}
              disabled={submitting || nothingPicked}
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />보내는 중</>
              ) : (
                '요청 보내기'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import StarRating from '@/components/StarRating.jsx'
import { submitReview } from '@/lib/reviews.js'
import { useModalDismiss } from '@/lib/useModalDismiss.js'
import { SHEET_OVERLAY, SHEET_PANEL } from '@/lib/sheet.js'

const BODY_MAX = 2000

/**
 * 후기 작성 모달.
 *
 * 별점 -> 태그 -> 자유 서술 순서로 둔다. 빈 입력창부터 마주하면 대부분
 * 그냥 닫는다. 태그를 먼저 고르게 하면 최소한의 정보는 남는다.
 *
 * 작성 자격 판정은 서버(eligibility)가 한다. 이 모달은 열릴 때 받은
 * eligibility 를 그대로 신뢰한다.
 */
export default function ReviewModal({ isOpen, onClose, reservation, allowedTags = [], onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState([])
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 닫을 때 입력을 비운다. ESC·바깥 클릭도 같은 경로를 타야 다음에 열었을 때
  // 이전 입력이 남지 않는다.
  const close = useCallback(() => {
    setRating(0)
    setTags([])
    setBody('')
    setError('')
    onClose()
  }, [onClose])

  // 훅은 조건부 return 앞에 있어야 한다.
  const overlay = useModalDismiss(isOpen, close)

  if (!isOpen || !reservation) return null

  const toggleTag = (tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const submit = async () => {
    if (rating < 1) {
      setError('별점을 선택해 주세요.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await submitReview({
        reservation_number: reservation.reservation_number,
        rating,
        tags,
        body: body.trim() || null,
      })
      onSubmitted?.()
      close()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={SHEET_OVERLAY}
      {...overlay}
    >
      <div className={`${SHEET_PANEL} max-w-md`}>
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">이용 후기 작성</h2>
            <p className="mt-1 text-sm text-gray-500">
              {reservation.desired_course || '택시투어'} · {String(reservation.tour_date || '').slice(0, 10)}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              이용 완료가 확인된 예약입니다
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">투어는 어떠셨나요?</p>
            <div className="mt-3 flex justify-center">
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>
          </div>

          {allowedTags.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-900">
                좋았던 점 <span className="font-normal text-gray-400">선택</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {allowedTags.map((tag) => {
                  const on = tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        on
                          ? 'border-yellow-400 bg-yellow-50 font-medium text-yellow-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="review-body" className="text-sm font-semibold text-gray-900">
              한마디 <span className="font-normal text-gray-400">선택</span>
            </label>
            <textarea
              id="review-body"
              value={body}
              maxLength={BODY_MAX}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              placeholder="다음에 오실 분들께 도움이 될 이야기를 들려주세요."
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-yellow-400"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {body.length} / {BODY_MAX}
            </p>
          </div>

          <p className="text-xs text-gray-500">
            등록한 후기는 상품 페이지에 공개되며, 이름은 첫 글자만 표시됩니다.
          </p>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <Button variant="outline" onClick={close} className="flex-1" disabled={submitting}>
              취소
            </Button>
            <Button onClick={submit} className="flex-1" disabled={submitting || rating < 1}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              등록하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

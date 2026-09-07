'use client'

import { Star } from 'lucide-react'

/**
 * 별점 표시. 입력용은 onChange 를 넘기면 버튼으로 바뀐다.
 *
 * 반쪽 별은 그리지 않는다. 평균은 숫자로 함께 보여주므로
 * 별은 대략의 인상만 전하면 충분하다.
 */
export default function StarRating({ value = 0, onChange, size = 'sm', label }) {
  const px = size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  const rounded = Math.round(Number(value) || 0)

  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={label || `별점 ${value}점`}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Star
            key={score}
            className={`${px} ${score <= rounded ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          aria-label={`${score}점`}
          aria-pressed={score === rounded}
          className="rounded p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          <Star
            className={`${px} ${score <= rounded ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

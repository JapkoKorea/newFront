'use client'

import ReviewList from '@/components/ReviewList.jsx'

// 상품을 가리지 않고 전체 후기를 보여준다. productSlug 를 넘기지 않으면
// ReviewList 가 전체를 조회한다.
export default function ReviewsPageClient() {
  return (
    <div className="mt-8">
      <ReviewList />
    </div>
  )
}

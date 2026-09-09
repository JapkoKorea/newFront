import ReviewsPageClient from './ReviewsPageClient.jsx'

// 후기는 예약을 고민하는 사람이 가장 먼저 찾는 것이라 검색에도 걸려야 한다.
export const metadata = {
  title: '이용 후기',
  description: '잽코 택시투어를 이용하신 분들의 후기입니다. 비에이·후라노 택시투어 실제 이용 경험을 확인해 보세요.',
  alternates: { canonical: '/reviews' },
}

export default function ReviewsPage() {
  return (
    <div className="min-h-screen bg-white px-4 pt-24 pb-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">이용 후기</h1>
        <p className="mt-2 text-gray-600">
          투어를 다녀오신 분들이 남긴 후기입니다. 후기는 이용을 마친 예약에만 작성할 수 있습니다.
        </p>
        <ReviewsPageClient />
      </div>
    </div>
  )
}

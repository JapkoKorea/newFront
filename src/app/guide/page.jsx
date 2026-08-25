import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { guideIndex } from '@/data/guideContent.js'

export const metadata = {
  title: '홋카이도 관광 가이드',
  description: '비에이·후라노 관광 명소, 계절별 추천 코스, 렌터카 vs 택시투어 비교까지. 홋카이도 여행 정보를 한곳에서.',
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: '홈', item: 'https://japko.kr' },
                { '@type': 'ListItem', position: 2, name: '관광 가이드', item: 'https://japko.kr/guide' },
              ],
            }),
          }}
        />

        <div className="text-center mb-10">
          <p className="text-yellow-500 font-medium mb-2">관광 가이드</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">홋카이도 관광 가이드</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            비에이·후라노 여행을 처음 계획하는 분들을 위한 정보 허브.
            명소, 시즌, 이동 방법까지 한곳에서 확인하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {guideIndex.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guide/${guide.slug}`}
              className="group block border rounded-xl p-6 hover:shadow-md hover:border-yellow-300 transition-all bg-white"
            >
              <div className="text-3xl mb-3">{guide.icon}</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors">
                {guide.title}
              </h2>
              <p className="text-sm text-gray-600 mb-4">{guide.description}</p>
              <span className="text-yellow-500 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                읽어보기 <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>

        <div className="bg-yellow-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">정보 확인 후 바로 예약하세요</h2>
          <p className="text-gray-600 mb-4">비에이·후라노 맞춤형 택시투어 코스를 둘러보세요.</p>
          <Link
            href="/tours"
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            투어 코스 보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

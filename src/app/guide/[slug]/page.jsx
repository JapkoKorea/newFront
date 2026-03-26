import { guidePages } from '@/data/guideContent.js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

export async function generateStaticParams() {
  return Object.keys(guidePages).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const page = guidePages[slug]
  if (!page) return {}
  return {
    title: `${page.title} | 잽코 택시투어`,
    description: page.description,
  }
}

export default async function GuideDetailPage({ params }) {
  const { slug } = await params
  const page = guidePages[slug]
  if (!page) notFound()

  return (
    <div className="min-h-screen bg-white pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: page.title,
              description: page.description,
              dateModified: page.lastModified,
              publisher: { '@type': 'Organization', name: '잽코 택시투어' },
              inLanguage: 'ko',
            }),
          }}
        />

        {/* 브레드크럼 */}
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 flex-wrap">
          <Link href="/" className="hover:text-yellow-500">홈</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/guide" className="hover:text-yellow-500">관광 가이드</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900">{page.title}</span>
        </nav>

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{page.title}</h1>
          <p className="text-lg text-gray-600 mb-3">{page.description}</p>
          {page.lastModified && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />마지막 업데이트: {page.lastModified}
            </p>
          )}
        </div>

        {/* 리드 텍스트 */}
        {page.hero && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-5 rounded-r-lg mb-8">
            <p className="text-gray-700 leading-relaxed">{page.hero}</p>
          </div>
        )}

        {/* 섹션 */}
        <div className="space-y-10">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b">{section.heading}</h2>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <div key={item.name} className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                    {item.bestSeason && (
                      <p className="text-xs text-yellow-600 mt-2 font-medium">추천 시즌: {item.bestSeason}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* 하단 CTA */}
        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" size="lg">
            <Link href="/tours">투어 코스 보기</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/guide"><ArrowLeft className="h-4 w-4 mr-2" />다른 가이드 보기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

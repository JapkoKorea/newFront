import PricingDepositPage from '@/components/PricingDepositPage.jsx'
import { buildFaqSchema } from '@/components/JsonLd.jsx'
import { PRICING_FAQ } from '@/data/pricingFaq.js'

// PricingDepositPage 는 클라이언트 컴포넌트라 metadata 를 내보낼 수 없다.
// 서버 컴포넌트인 이 파일에서 선언해야 검색 결과에 제목/설명이 나간다.
export const metadata = {
  title: '요금 안내 — 시간당 요금과 예약금',
  description:
    '비에이·후라노 택시투어 요금표. 일반 택시 시간당 8,640엔, 점보 택시 10,940엔. 예약금은 15,000원이며 당일·전일 예약은 20,000원입니다.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: '잽코 택시투어 요금 안내',
    description: '시간당 택시 요금과 예약금을 한 페이지에서 확인하세요.',
    url: '/pricing',
  },
}

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(PRICING_FAQ)) }}
      />
      <PricingDepositPage />
    </>
  )
}

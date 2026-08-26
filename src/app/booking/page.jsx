import BookingPageClient from '@/components/BookingPageClient.jsx'

// 코스 맥락 유무를 쿼리로 판단해 서버에서 바로 알맞은 단계를 그린다.
// 정적 프리렌더로는 sessionStorage 의 prefill 을 알 수 없어, 코스 선택 화면이
// 잠깐 보였다 사라지는 문제가 있었다.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '택시투어 예약 입력',
  description: '비에이 택시투어 예약 정보를 입력하고 결제 단계로 이동하세요.',
}

export default async function BookingPage({ searchParams }) {
  const params = await searchParams
  const fromProduct = params?.from === 'product'

  return <BookingPageClient fromProduct={fromProduct} />
}

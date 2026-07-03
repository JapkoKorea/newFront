import { redirect } from 'next/navigation'

// commerce-first 개편: 코스 목록은 /products(상품 카탈로그)로 일원화.
// 코스별 지도 빌더(/tours/[id])는 상품 상세의 "커스터마이징"에서 계속 사용.
export default function ToursPage() {
  redirect('/products')
}

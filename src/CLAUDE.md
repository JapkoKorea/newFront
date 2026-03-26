# src/ — 프론트엔드 작업 가이드

Next.js 15 + App Router 기반 프론트엔드. 비에이 택시투어 예약 UI 전체를 담당.

## 진입점

- `src/app/layout.jsx` — 루트 레이아웃 (Navigation 포함), metadata 설정
- `src/app/globals.css` — 전역 CSS (Tailwind v4 `@import "tailwindcss"`)

## 라우트 구조

| 경로 | 파일 | 렌더링 |
|------|------|--------|
| `/` | `app/page.jsx` | Client (풀페이지 스크롤) |
| `/tours` | `app/tours/page.jsx` | Server + Client 필터 |
| `/tours/[id]` | `app/tours/[id]/page.jsx` | SSG |
| `/guide` | `app/guide/page.jsx` | Server |
| `/guide/[slug]` | `app/guide/[slug]/page.jsx` | SSG |
| `/login` | `app/login/page.jsx` | Client (OAuth 콜백 포함) |
| `/pricing` | `app/pricing/page.jsx` | Client (dynamic ssr:false) |
| `/payments` | `app/payments/page.jsx` | Client (dynamic ssr:false) |
| `/payments/success` | `app/payments/success/page.jsx` | Client (dynamic ssr:false) |
| `/payments/fail` | `app/payments/fail/page.jsx` | Client (dynamic ssr:false) |
| `/reservations` | `app/reservations/page.jsx` | Client (dynamic ssr:false) |

## 전역 상태 (Navigation.jsx)

- 로그인 상태: `localStorage('jwt', 'user')` → `isLoggedIn`, `nickname`
- 모달 상태: `isBookingOpen`, `isFAQOpen`, `isChatOpen`

## 핵심 규칙

- 함수형 컴포넌트 + 훅만 사용
- 스타일: Tailwind 클래스만 (인라인 `style` 객체 금지, 단 동적 transform 제외)
- UI 기본 요소: `@/components/ui/`에서 import (`Button`, `Dialog` 등)
- 아이콘: `lucide-react`만 사용
- 환경변수: `process.env.NEXT_PUBLIC_*` 형태로만 접근
- `localStorage` 접근은 반드시 `useEffect` 안에서 또는 `dynamic({ ssr: false })` 페이지에서
- 라우팅: `useRouter`, `usePathname` from `next/navigation`, `Link` from `next/link`
- 백엔드 API 호출: `src/lib/api.js`의 `API_BASE_URL` 사용

## 환경변수 (`.env.local`)

```
NEXT_PUBLIC_KAKAO_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 자주 쓰는 패턴

```jsx
// API 호출 예시
import { API_BASE_URL } from '@/lib/api.js'
const res = await fetch(`${API_BASE_URL}/api/reservations`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` }
})

// UI 컴포넌트 import
import { Button } from '@/components/ui/button.jsx'
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx'

// 라우팅
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

// 아이콘
import { MapPin, Clock } from 'lucide-react'

// SSR 불안전 컴포넌트 (localStorage 사용)
import dynamic from 'next/dynamic'
const MyComponent = dynamic(() => import('@/components/MyComponent'), { ssr: false })
```

## 폴더 구성

```
src/
├── app/             # Next.js App Router 페이지
│   ├── layout.jsx   # 루트 레이아웃
│   ├── globals.css  # Tailwind + CSS 변수
│   ├── page.jsx     # 홈 (/)
│   ├── tours/       # /tours, /tours/[id]
│   ├── guide/       # /guide, /guide/[slug]
│   ├── login/       # /login
│   ├── pricing/     # /pricing
│   ├── payments/    # /payments, /success, /fail
│   └── reservations/ # /reservations
├── components/      # 기능 컴포넌트 (→ components/CLAUDE.md 참조)
├── assets/          # 이미지 (비에이 풍경 .webp/.jpg)
├── data/            # 정적 콘텐츠 데이터 (guideContent.js 등)
└── lib/             # 유틸리티 (api.js 등)
```

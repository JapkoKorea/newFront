# src/ — 프론트엔드 작업 가이드

Next.js 15 + App Router 기반 프론트엔드. 비에이 택시투어 예약 UI 전체를 담당.

## 진입점

- `src/app/layout.jsx` — 루트 레이아웃 (Navigation 포함), metadata 설정
- `src/app/globals.css` — 전역 CSS (Tailwind v4 `@import "tailwindcss"`)

## 라우트 구조

| 경로 | 파일 | 렌더링 |
|------|------|--------|
| `/` | `app/page.jsx` | Client (일반 스크롤 랜딩) |
| `/products` | `app/products/page.jsx` | Server + Client 필터 |
| `/products/[slug]` | `app/products/[slug]/page.jsx` | SSG |
| `/booking` | `app/booking/page.jsx` | Client (force-dynamic) |
| `/pricing` | `app/pricing/page.jsx` | Client (dynamic ssr:false) |
| `/payments` `/success` `/fail` | `app/payments/**` | Client (dynamic ssr:false) |
| `/reservations` | `app/reservations/page.jsx` | Client (dynamic ssr:false) |
| `/reviews` | `app/reviews/page.jsx` | Client |
| `/transfer-booking` | `app/transfer-booking/page.jsx` | Client |
| `/admin` | `app/admin/page.jsx` | Client (운영자용) |
| `/login` | `app/login/page.jsx` | Client (OAuth 콜백 포함) |
| `/guide` `/guide/[slug]` | `app/guide/**` | Server / SSG |
| `/tours` | `app/tours/page.jsx` | `/products` 로 리다이렉트 |
| `/tours/[id]` | `app/tours/[id]/page.jsx` | SSG (코스 상세·지도 빌더) |
| `/terms` `/privacy` `/refund` | `app/**` | Server |

## 전역 상태 (Navigation.jsx)

- 로그인 상태: `useSession()` → `{ isLoggedIn, nickname, settled }`
  (액세스 토큰은 메모리, 리프레시 토큰은 httpOnly 쿠키. `localStorage` 에는 표시용 `user` 힌트만)
- 모달 상태: `isBookingOpen`, `isFAQOpen`, `isChatOpen`

## 모바일 규칙

- 누르는 요소는 최소 44x44. 공용 `Button` 은 `size="touch"` / `size="touchIcon"`
- 모달은 `@/lib/sheet.js` 의 `SHEET_OVERLAY` / `SHEET_PANEL`(또는 `_FLEX` + `SHEET_BODY`)
  — 폰에서 바텀시트, `sm` 이상에서 가운데 모달
- 높이는 `vh` 대신 `dvh` / `svh`
- 하단 고정 요소에는 `pb-safe` / `bottom-safe`, 본문 끝에는 `pb-safe-bar`
- 하단 액션 바를 쓰는 화면은 `useDeclareBottomBar()` 로 알린다 (플로팅 버튼이 접힌다)

## 핵심 규칙

- 함수형 컴포넌트 + 훅만 사용
- 스타일: Tailwind 클래스만 (인라인 `style` 객체 금지, 단 동적 transform 제외)
- UI 기본 요소: `@/components/ui/`에서 import (`Button`, `Dialog` 등)
- 아이콘: `lucide-react`만 사용
- 환경변수: `process.env.NEXT_PUBLIC_*` 형태로만 접근
- `localStorage` 접근은 반드시 `useEffect` 안에서 또는 `dynamic({ ssr: false })` 페이지에서
- 라우팅: `useRouter`, `usePathname` from `next/navigation`, `Link` from `next/link`
- 백엔드 API 호출: 인증 필요하면 `apiFetch`/`apiFetchJson`, 공개 API 만 `API_BASE_URL` + `fetch`
- 액세스 토큰을 `localStorage` 에 저장하거나 직접 읽지 말 것

## 환경변수 (`.env.local`)

```
NEXT_PUBLIC_KAKAO_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## 자주 쓰는 패턴

```jsx
// 인증이 필요한 API 호출 — 토큰 확보와 만료 재시도를 apiFetch 가 맡는다
import { apiFetch, apiFetchJson } from '@/lib/api.js'
const res = await apiFetch('/api/reservations')
const created = await apiFetchJson('/api/reservations', { method: 'POST', body: payload })

// 로그인 상태 — settled 전에는 로그인 안내를 띄우지 말 것
import { useSession } from '@/lib/useSession.js'
const { isLoggedIn, settled } = useSession()

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
│   ├── products/    # /products, /products/[slug] (카탈로그)
│   ├── tours/       # /tours → /products 리다이렉트, /tours/[id] 코스 상세
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

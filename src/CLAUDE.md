# src/ — 프론트엔드 작업 가이드

React 19 + Vite 기반 프론트엔드. 비에이 택시투어 예약 UI 전체를 담당.

## 진입점

- `main.jsx` — ReactDOM 렌더링, BrowserRouter 감싸기
- `App.jsx` — 라우트 정의, 전역 로그인 상태, 네비게이션, 모달 열기/닫기 조율

## 라우트 구조

| 경로 | 컴포넌트 |
|------|----------|
| `/` | 메인 랜딩 (히어로 + 서비스 소개, 풀페이지 스크롤) |
| `/login` | 카카오 로그인 / OAuth 콜백 처리 |
| `/pricing` | `PricingDepositPage` — 요금 및 보증금 안내 |
| `/payments` | `PaymentPage` — 결제 진행 |
| `/payments/success` | `PaymentSuccessPage` |
| `/payments/fail` | `PaymentFailPage` |
| `/reservations` | `ReservationCheckPage` — 예약 조회 및 취소 |

## 전역 상태 (App.jsx)

- 로그인 상태: `localStorage('jwt', 'user')` → `isLoggedIn`, `nickname`
- 모달 상태: `isBookingOpen`, `isFAQOpen`, `isChatOpen` (동시에 하나만 열림)
- 풀페이지 스크롤: `currentSection` (0 = 히어로, 1 = 서비스 소개), 모달 열릴 때 비활성화

## 핵심 규칙

- 함수형 컴포넌트 + 훅만 사용
- 스타일: Tailwind 클래스만 (인라인 `style` 객체 금지, 단 동적 transform 제외)
- UI 기본 요소: `@/components/ui/`에서 import (`Button`, `Dialog` 등)
- 아이콘: `lucide-react`만 사용
- 환경변수: `import.meta.env.VITE_*` 형태로만 접근
- 백엔드 API 호출: `http://localhost:8000` (개발), 프로덕션은 env로

## 환경변수 (`.env.local`)

```
VITE_KAKAO_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_API_BASE_URL=http://localhost:8000
```

## 자주 쓰는 패턴

```jsx
// API 호출 예시
const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/reservations`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` }
})

// UI 컴포넌트 import
import { Button } from '@/components/ui/button.jsx'
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx'

// 아이콘
import { MapPin, Clock } from 'lucide-react'
```

## 폴더 구성

```
src/
├── App.jsx          # 라우팅 + 전역 상태
├── main.jsx         # 진입점
├── App.css          # 전역 CSS (최소화)
├── index.css        # Tailwind base
├── assets/          # 이미지 (비에이 풍경 .webp/.jpg)
├── components/      # 기능 컴포넌트 (→ components/CLAUDE.md 참조)
├── hooks/           # 커스텀 훅
└── lib/             # 유틸리티 함수
```

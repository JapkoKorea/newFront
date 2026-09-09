# Japan Taxi Tour — Claude 작업 가이드

비에이(美瑛) 지역 전문 택시투어 예약 서비스. React 프론트엔드 + FastAPI 백엔드 풀스택 구성.

## 아키텍처 요약

| 레이어 | 기술 | 포트 |
|--------|------|------|
| Frontend | Next.js 15 + App Router | 3000 |
| Backend | FastAPI + Uvicorn | 8000 |
| UI | Tailwind CSS + Radix UI (`@/components/ui/`) | — |
| 지도 | Google Maps JavaScript API | — |
| 인증 | Kakao OAuth + JWT | — |
| DB | MySQL (python-dotenv로 설정) | — |

## 개발 명령어

```bash
# 프론트엔드
pnpm dev          # Next.js 개발 서버 (port 3000)
pnpm build        # 프로덕션 빌드 → .next/
pnpm start        # 프로덕션 서버 실행
pnpm lint         # ESLint 검사

# 백엔드 (port 5000)
python backend/main.py
```

## 절대 금지 사항

- `.env` / `.env.local` 파일 커밋 금지 (API 키 포함)
- Kakao Client ID / Google Maps API 키 소스코드 하드코딩 금지
- 프로덕션에서 `allow_origins=["*"]` CORS 전체 허용 금지
- JWT secret / 사용자 토큰 로그 출력 금지
- `.next/` 빌드 산출물 버전 관리 금지

## 필수 준수 사항

- 프론트엔드 환경변수: `NEXT_PUBLIC_*` 접두어 + `process.env.NEXT_PUBLIC_*`
- 백엔드 환경변수: `python-dotenv` 사용
- Google Maps API 응답은 좌표 사용 전 반드시 유효성 검사
- Kakao OAuth 리디렉션 URI: 프론트/백 양쪽 동기화 유지

## 코딩 규칙

### Frontend (Next.js App Router)
- 함수형 컴포넌트 + 훅만 사용 (클래스 컴포넌트 금지)
- 브라우저 API / 훅 사용 컴포넌트는 파일 상단에 `'use client'` 추가 필수
- SSG 대상 페이지(tours, guide)는 서버 컴포넌트로 유지
- 클라이언트 전용 페이지(payments, reservations)는 `dynamic({ ssr: false })` 사용
- 스타일링: Tailwind CSS만 사용 (인라인 스타일 금지)
- UI 컴포넌트: `@/components/ui/`에서 import (Radix 기반)
- 아이콘: `lucide-react` 일관 사용
- 폼 상태: React `useState`로 직접 관리
- 라우팅: `next/link`, `next/navigation` 사용 (react-router-dom 금지)

### Backend (FastAPI)
- PEP 8 스타일 준수
- 모든 요청/응답 스키마는 Pydantic 모델 정의
- 라우터는 얇게 유지 — 비즈니스 로직은 `services/`에
- I/O 작업(HTTP, DB)은 `async/await` 사용
- 모든 함수 시그니처에 타입 힌트 필수

### Git 커밋 형식
```
<type>: <description>
```
`feat` | `fix` | `refactor` | `docs` | `style` | `test`

예: `feat: add multi-step booking form validation`

## API 계약

- 모든 백엔드 라우트: `/api` 접두어
- Kakao OAuth 콜백: `POST /api/auth/kakao/callback`
- CORS: 개발 환경 `localhost:3000`, 프로덕션은 실제 도메인 (`CORS_ALLOW_ORIGINS`)

## 주요 기능 흐름

### 예약 흐름 (TaxiBooking.jsx)
3단계 폼: 코스 선택 → 예약 입력(경로 · 일정 · 조건) → 예약자 정보

상품 상세에서 코스를 골라 들어오면(`?from=product`) 1단계를 건너뛰고,
경로 섹션은 요약으로 접힌 채 시작한다.

### 인증 (Kakao OAuth)
- 카카오 소셜 로그인만 지원 (로컬 인증 없음)
- JWT 발급 → 프론트엔드 `localStorage` 저장 (`jwt`, `user` 키)
- 로그인 상태: `localStorage` 기반, 라우트 변경 시 재확인

### 지도 (Google Maps)
- 비에이/아사히카와 지역으로 제한
- 픽업/드롭오프 커스텀 마커
- 경로 시각화

## 디렉토리 구조

```
japan-taxi-tour/
├── src/                        # 프론트엔드 (Next.js App Router)
│   ├── app/                    # 라우트 (page.jsx 20개)
│   │   ├── layout.jsx          # 루트 레이아웃 (Navigation/Footer/AppShellProvider)
│   │   ├── globals.css         # Tailwind v4 + 세이프 에어리어 유틸
│   │   ├── page.jsx            # 홈 (히어로 → 상품 피드 → 신뢰 스트립 → 후기)
│   │   ├── products/           # 상품 카탈로그, 상품 상세
│   │   ├── booking/            # 예약 입력
│   │   ├── pricing/            # 요금 확인
│   │   ├── payments/           # 계좌이체 / 스마트스토어
│   │   ├── reservations/       # 예약 조회·변경·취소·후기
│   │   ├── reviews/            # 이용 후기
│   │   ├── admin/              # 운영자 화면
│   │   └── guide/              # 관광 가이드 (SSG)
│   ├── components/             # 기능 컴포넌트 + ui/ (Radix 기반)
│   ├── products/               # 상품 레지스트리 (registry.js, items/)
│   ├── data/                   # 정적 콘텐츠 (tourCourses, company, guideContent)
│   ├── lib/                    # api, appShell, sheet, reservationStatus 등
│   └── assets/                 # 정적 이미지
├── backend/                    # 백엔드 (FastAPI, port 5000)
│   ├── main.py                 # 앱 팩토리, CORS, 라우터 등록
│   ├── routers/                # admin, auth/, chat, courses, maps,
│   │                           # payments, reservations, reviews, seo
│   ├── services/               # DB·외부 연동 로직
│   ├── dependencies/           # auth (JWT 검증)
│   └── scripts/                # 일회성 스크립트
├── mobile/                     # Flutter 앱 (현재 보류)
├── public/assets/              # 상품 대표 이미지
├── package.json
└── .env / .env.local           # git 제외
```

## 컨텍스트 맵 (작업별 위치)

| 작업 | 위치 |
|------|------|
| 예약 UI 수정 | `src/components/TaxiBooking.jsx` |
| 지도 기능 | `src/components/MapContainer.jsx` |
| 결제 흐름 | `src/components/PaymentPage.jsx`, `backend/routers/payments.py` |
| 예약 조회/취소 | `src/components/ReservationCheckPage.jsx`, `backend/routers/reservations.py` |
| 요금 안내 | `src/components/PricingDepositPage.jsx` |
| 카카오 인증 | `src/components/LoginKakao.jsx`, `src/app/login/page.jsx`, `backend/routers/auth/kakao.py` |
| 공통 UI 컴포넌트 | `src/components/ui/` (직접 수정 금지, variant 추가로) |
| 모바일 시트/세이프에어리어 | `src/lib/sheet.js`, `src/app/globals.css` |
| DB 로직 | `backend/services/` |
| 라우팅/전역 상태 | `src/app/layout.jsx`, `src/lib/appShell.jsx` |
| 상품 정의 | `src/products/items/`, `src/products/registry.js` |
| 환경변수 | `.env.local` (gitignored) |

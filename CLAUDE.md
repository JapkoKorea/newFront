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

# 백엔드
uvicorn backend.main:app --reload --port 8000
python backend/main.py   # 대안 실행 (port 5000)
```

## 절대 금지 사항

- `.env` / `.env.local` 파일 커밋 금지 (API 키 포함)
- Kakao Client ID / Google Maps API 키 소스코드 하드코딩 금지
- 프로덕션에서 `allow_origins=["*"]` CORS 전체 허용 금지
- JWT secret / 사용자 토큰 로그 출력 금지
- `dist/` 빌드 산출물 버전 관리 금지

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
- CORS: 개발 환경 `localhost:5173`, 프로덕션은 실제 도메인

## 주요 기능 흐름

### 예약 흐름 (TaxiBooking.jsx)
4단계 멀티스텝 폼: 코스 선택 → 일정 선택 → 경로 설정 → 연락처 입력

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
├── src/                        # 프론트엔드 (React)
│   ├── components/             # React 컴포넌트
│   │   ├── TaxiBooking.jsx    # 예약 모달 (4단계)
│   │   ├── MapContainer.jsx   # Google Maps 연동
│   │   ├── ReservationCheckPage.jsx  # 예약 조회/취소
│   │   ├── PaymentPage.jsx    # 결제 처리
│   │   ├── PricingDepositPage.jsx    # 요금/보증금 안내
│   │   ├── ChatSupport.jsx    # 채팅 상담 위젯
│   │   ├── FAQ.jsx            # FAQ 모달
│   │   ├── LoginKakao.jsx     # 카카오 로그인 버튼
│   │   └── ui/                # Radix UI 기반 공통 컴포넌트
│   ├── assets/                # 정적 이미지 (비에이 풍경 등)
│   ├── App.jsx                # 라우팅 및 전역 상태
│   └── main.jsx               # React 진입점
├── app/                        # 백엔드 (FastAPI)
│   ├── main.py                # 앱 팩토리, 미들웨어, 라우터 등록
│   ├── routers/
│   │   ├── auth/kakao.py      # 카카오 OAuth 핸들러
│   │   ├── reservations.py    # 예약 CRUD API
│   │   └── payments.py        # 결제 API
│   └── services/
│       ├── mysql_user_service.py        # 사용자 DB 로직
│       └── mysql_reservation_service.py # 예약 DB 로직
├── public/                     # 정적 public 애셋
├── package.json               # Node 의존성
├── pyproject.toml             # Python 의존성
├── vite.config.js             # Vite 설정, 경로 별칭
└── .env.local                 # 로컬 환경변수 (git 제외)
```

## 컨텍스트 맵 (작업별 위치)

| 작업 | 위치 |
|------|------|
| 예약 UI 수정 | `src/components/TaxiBooking.jsx` |
| 지도 기능 | `src/components/MapContainer.jsx` |
| 결제 흐름 | `src/components/PaymentPage.jsx`, `app/routers/payments.py` |
| 예약 조회/취소 | `src/components/ReservationCheckPage.jsx`, `app/routers/reservations.py` |
| 요금 안내 | `src/components/PricingDepositPage.jsx` |
| 카카오 인증 | `src/components/LoginKakao.jsx`, `app/routers/auth/kakao.py` |
| 공통 UI 컴포넌트 | `src/components/ui/` |
| DB 로직 | `app/services/` |
| 라우팅/전역 상태 | `src/App.jsx` |
| Vite 설정/별칭 | `vite.config.js` |
| 환경변수 | `.env.local` (gitignored) |

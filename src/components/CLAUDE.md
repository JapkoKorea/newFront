# src/components/ — React 컴포넌트 가이드

기능 컴포넌트 모음. `ui/`는 Radix UI 기반 공통 프리미티브.

## 주요 컴포넌트

### 예약 흐름
| 파일 | 역할 |
|------|------|
| `TaxiBooking.jsx` | 예약 모달 (4단계: 코스→일정→경로→연락처), `useState`로 폼 관리 |
| `MapContainer.jsx` | Google Maps 연동, 픽업/드롭오프 마커, 경로 렌더링 |
| `RouteRenderer.jsx` | 지도 위 경로 시각화 보조 |
| `MarkerWithLabel.jsx` | 커스텀 지도 마커 |

### 결제 흐름
| 파일 | 역할 |
|------|------|
| `PaymentPage.jsx` | 결제 처리 UI (`/payments`) |
| `PaymentSuccessPage.jsx` | 결제 성공 (`/payments/success`) |
| `PaymentFailPage.jsx` | 결제 실패 (`/payments/fail`) |
| `PricingDepositPage.jsx` | 요금표 + 보증금 정책 안내 (`/pricing`) |

### 예약 관리
| 파일 | 역할 |
|------|------|
| `ReservationCheckPage.jsx` | 예약 조회 + 취소 (`/reservations`) |

### 인증
| 파일 | 역할 |
|------|------|
| `LoginKakao.jsx` | 카카오 로그인 버튼 |
| `LoginKakaoCallback.jsx` | OAuth 인가코드 수신 후 백엔드 호출, 토큰 저장 |
| `LoginKakaoCallback.js` | (레거시, 사용 여부 확인 필요) |

### 지원
| 파일 | 역할 |
|------|------|
| `FAQ.jsx` | FAQ 모달 |
| `ChatSupport.jsx` | 채팅 상담 위젯 |

## ui/ 공통 컴포넌트

Radix UI 기반. **직접 수정 금지** — 새 스타일이 필요하면 `variant` prop 추가 또는 래핑.

자주 쓰는 것:
- `button.jsx` — `<Button variant="outline|ghost|..." size="sm|lg">`
- `dialog.jsx` — `<Dialog>`, `<DialogContent>`, `<DialogHeader>`
- `input.jsx` — 기본 입력 필드
- `select.jsx` — 드롭다운
- `card.jsx` — 카드 레이아웃
- `badge.jsx` — 상태 배지
- `skeleton.jsx` — 로딩 플레이스홀더

## 컴포넌트 작성 규칙

1. **함수형 + 훅** — 클래스 컴포넌트 사용 금지
2. **Props 명확히** — 모달 컴포넌트는 `isOpen`, `onClose` props 패턴 유지
3. **단일 책임** — 하나의 컴포넌트는 하나의 역할
4. **Tailwind만** — `className`으로 스타일링, 인라인 style은 동적 값(transform, backgroundImage)에만
5. **토스트 알림** — `react-hot-toast` 사용 (`import toast from 'react-hot-toast'`)

## Google Maps 작업 시 주의

- API 키: `process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- 응답 좌표는 사용 전 항상 null/undefined 체크
- 지도 로드 전 API 응답 사용 시 에러 발생 → `isLoaded` 상태 확인
- 지역 제한: 비에이(美瑛) / 아사히카와(旭川) 주변

## Kakao OAuth 흐름

```
LoginKakao.jsx → 카카오 인가 URL 리디렉션
→ /login?code=xxx 로 돌아옴
→ LoginKakaoCallback.jsx → POST /api/auth/kakao/callback
→ JWT + user 정보 localStorage 저장
→ router.push('/')
```

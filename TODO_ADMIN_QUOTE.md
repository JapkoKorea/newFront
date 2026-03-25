# 관리자 견적 관리 기능 (숙제)

송영서비스의 견적(Quote) 기반 예약 흐름에서 관리자(기사) 측 기능 구현 목록.

## 고객 측 흐름 (구현 완료)

```
고객: 출발지/도착지/경유지 지도에서 선택
→ 일정·인원·짐 입력
→ 견적 요청 제출 (status: requested)
→ 예약 확인 페이지에서 견적 대기
→ 기사가 견적 제시하면 수락/거절
→ 수락 시 예약금 결제 → 예약 확정
```

## 관리자 측 TODO

### 1. 견적 관리 대시보드

- [ ] 관리자 로그인/인증 (별도 role 또는 별도 앱)
- [ ] `status = 'requested'`인 송영 예약 목록 조회
- [ ] 예약 상세 보기 (출발지, 도착지, 경유지, 인원, 짐, 특별요청)
- [ ] 견적 입력 폼: `quoted_price_jpy`, `deposit_krw`, `quote_note`
- [ ] 견적 제출 → DB 업데이트 (status: `quoted`)

### 2. 백엔드 API

- [ ] `POST /api/admin/reservations/{id}/quote` — 견적 제출
  - body: `{ quoted_price_jpy, deposit_krw, quote_note }`
  - reservations 테이블에 견적 정보 저장, status → `quoted`
- [ ] `GET /api/admin/reservations?service_type=transfer&status=requested` — 견적 대기 목록
- [ ] `PATCH /api/admin/reservations/{id}/status` — 상태 변경 (confirmed, rejected 등)
- [ ] 관리자 인증 미들웨어 (`role = 'admin'` 또는 별도 토큰)

### 3. DB 스키마 변경 (견적 컬럼)

reservations 테이블에 추가 필요:

```sql
ALTER TABLE reservations ADD COLUMN quoted_price_jpy INT UNSIGNED NULL;
ALTER TABLE reservations ADD COLUMN deposit_krw INT UNSIGNED NULL;
ALTER TABLE reservations ADD COLUMN quoted_at DATETIME(6) NULL;
ALTER TABLE reservations ADD COLUMN quote_expires_at DATETIME(6) NULL;
ALTER TABLE reservations ADD COLUMN quote_note TEXT NULL;
```

### 4. 고객 측 견적 응답 UI (ReservationCheckPage)

- [ ] 송영 예약의 status가 `quoted`일 때 견적 정보 표시
  - 견적 금액 (JPY), 예약금 (KRW), 기사 메모
  - 견적 유효기간 표시
- [ ] 수락 버튼 → `PATCH /api/reservations/{id}/accept-quote` → status: `accepted` → 결제 페이지 이동
- [ ] 거절 버튼 → `PATCH /api/reservations/{id}/decline-quote` → status: `declined`

### 5. 결제 연동

- [ ] `payments.py`의 `_calculate_amount_krw`에서 transfer일 때 `deposit_krw` 컬럼 값 사용
- [ ] 견적 수락(accepted) 상태에서만 결제 허용

### 6. 알림 (선택)

- [ ] 견적 요청 시 관리자에게 알림 (카카오톡/이메일/푸시)
- [ ] 견적 제시 시 고객에게 알림

## 송영 예약 상태 흐름도

```
requested → quoted → accepted → paid → confirmed
                  → declined
         → cancelled (고객 취소)
         → rejected (관리자 거절)
```

## 우선순위

1. DB 스키마 변경 (견적 컬럼) — 다른 작업의 선행 조건
2. 관리자 API — 견적 제출/목록 조회
3. 고객 측 견적 수락 UI — ReservationCheckPage 수정
4. 결제 연동 — deposit_krw 기반 결제
5. 관리자 대시보드 UI — 별도 프론트엔드 또는 관리 페이지
6. 알림 — 나중에

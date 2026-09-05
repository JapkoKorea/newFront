# 예약 변경 기획

예약된 투어의 날짜·시간을 고객이 바꾸고 싶을 때의 흐름을 정의한다.
상품 이용 규칙(`src/products/common.js`의 `POLICIES`)을 기준으로 설계했다.

---

## 1. 전제

**변경은 즉시 반영되지 않는다.** 약관도 "변경을 신청할 수 있습니다"라고만 한다.
배차가 가능한지 확인해야 하므로, 고객의 요청을 접수해 쌓아두고 운영자가 처리한다.

**결제와 예약 상태는 분리한다.** 결제 승인은 `payment_status`만 바꾸고,
예약 확정(`confirmed`)은 배차 확인 후 별도로 처리한다. 변경 요청도 결제와 무관하게 동작한다.

---

## 2. 약관에서 나온 규칙

| 약관 문구 | 구현 규칙 |
|---|---|
| 투어 일자 5일 전까지 날짜를 변경할 수 있습니다 | `D >= 5` 일 때만 날짜 변경 요청 가능 |
| 투어 일자 1일 전까지 이용 시간 변경을 신청할 수 있습니다 | `D >= 1` 일 때만 시간 변경 요청 가능 |
| 투어 당일 시간 변경은 상황에 따라 가능할 수 있습니다 | 당일(`D <= 0`)에는 **예약을 비활성화**하고 변경 요청을 받지 않는다. 당일 변경은 상담으로 유도 |

`D` = 투어 일자 − 오늘. **기준 시각은 투어 운행지(Asia/Tokyo)의 현지 날짜다.**
고객이 어디서 접속하든 "투어 며칠 전인가"는 현지 기준으로 세어야 운영 기준과 어긋나지 않는다.

### 새 날짜에도 같은 기준을 적용한다

변경 희망일도 배차 준비가 필요하다. `요청일 + 5일` 이후만 받는다.
오늘이 9월 4일이면 9월 9일 이후만 선택할 수 있다.

### 상태별 가능 여부

| 예약 상태 | 변경 요청 |
|---|---|
| `pending` (접수 완료) | 가능 |
| `confirmed` (확정) | 가능 |
| `cancelled` / `rejected` / `completed` | 불가 |

---

## 3. 화면 흐름

```
예약 확인 (/reservations)
  └ 예약 선택
      ├ [변경 요청]  ← change_window.isActive 일 때만 활성
      │   └ 변경 요청 모달
      │       ├ 날짜 변경   (canChangeDate 일 때만 입력 가능)
      │       ├ 시간 변경   (canChangeTime 일 때만 입력 가능)
      │       ├ 사유        (선택 입력, 비워도 됨)
      │       └ [요청 보내기] → 접수 완료 안내
      └ [문의하기] → 상담 봇 (별도 기획)
```

**버튼 활성 여부는 서버 판정을 그대로 따른다.** 프론트가 날짜 계산을 다시 구현하면
서버와 어긋나므로, 예약 조회 응답에 실려 오는 `change_window`만 보고 열고 닫는다.

당일이 지난 예약은 `isActive: false`가 되어 변경 버튼이 비활성화되고,
"투어 당일 이후에는 예약을 변경할 수 없습니다. 상담으로 문의해 주세요."가 표시된다.

---

## 4. DB 구조

### `reservation_change_requests`

요청을 **쌓아두는** 테이블. 예약 원본(`reservations`)은 건드리지 않는다.
운영자가 승인했을 때 비로소 원본 일정을 바꾼다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | |
| `reservation_number` | CHAR(36) FK | 대상 예약 |
| `user_id` | CHAR(36) FK | 요청자 |
| `request_type` | VARCHAR(16) | `date` / `time` / `both` |
| `current_tour_date` | DATE | **요청 시점의** 투어 일자 |
| `current_tour_start_time` | TIME | **요청 시점의** 시작 시각 |
| `requested_tour_date` | DATE NULL | 희망 날짜 (시간만 바꾸면 NULL) |
| `requested_tour_start_time` | TIME NULL | 희망 시각 (날짜만 바꾸면 NULL) |
| `reason` | TEXT NULL | 사유. **빈칸 허용** |
| `status` | VARCHAR(16) | `pending` / `approved` / `rejected` / `cancelled` |
| `admin_note` | TEXT NULL | 처리 메모 |
| `resolved_by` | CHAR(36) NULL | 처리한 운영자 |
| `resolved_at` | DATETIME(6) NULL | 처리 시각 |
| `created_at` / `updated_at` | DATETIME(6) | |

**요청 시점의 일정을 함께 남기는 이유**: 나중에 원본 일정이 바뀌어도
"무엇을 무엇으로 바꿔달라고 했는지"가 기록에 남아야 한다.

### 중복 요청 방지

한 예약에 `pending` 요청이 있으면 새 요청을 받지 않는다(409).
처리되기 전에 여러 건이 쌓이면 어느 것을 반영할지 모호해진다.

---

## 5. API

### 고객용 (구현 완료)

```
POST /api/reservations/{reservation_number}/change-requests
  body: { tour_date?, tour_start_time?, reason? }
  200 → { message, requestId, reservationNumber, requestType }
  400 → 입력 오류 (형식, 변경 내용 없음, 지난 날짜)
  409 → 규칙 위반 (당일 비활성, 기한 지남, 상태 불가, 중복 요청)

GET /api/reservations/{reservation_number}/change-requests
  200 → { requests: [...] }
```

예약 조회 응답에는 `change_window`가 함께 실린다.

```json
{
  "daysUntilTour": 3,
  "canChangeDate": false,
  "canChangeTime": true,
  "isActive": true,
  "notice": "투어까지 3일 남아 날짜 변경 기한(5일 전)은 지났습니다. 시간 변경만 요청할 수 있습니다."
}
```

### 운영자용 (구현 완료)

```
GET   /api/admin/me
  200 → { userId, displayName, role }   관리자 화면 진입 시 권한 확인

GET   /api/admin/change-requests?status=pending&limit=100
  200 → { requests: [...] }   대기 중인 요청이 먼저, 예약자 이름·연락처 포함

PATCH /api/admin/change-requests/{id}
  body: { status: 'approved' | 'rejected', admin_note? }
  200 → { message, requestId, status, applied, request }
  404 → 없는 요청
  409 → 이미 처리된 요청
```

**승인 시 처리**: `reservations`의 일정을 갱신하고, `reservation_status_history`에
이력을 남기고, 요청을 `approved`로 닫는다. 셋을 한 트랜잭션으로 묶어
"일정은 바뀌었는데 요청은 대기 중" 같은 어긋난 상태가 생기지 않게 한다.
동시 처리를 막기 위해 요청 행을 `FOR UPDATE`로 잠근다.

### 관리자 판별

`users.role` 컬럼을 쓴다. `role = 'admin'` 이면 관리자다.

**권한은 토큰이 아니라 매 요청 DB 에서 읽는다.** 토큰에 담으면 권한을
회수해도 만료될 때까지(기본 24시간) 관리자로 남고, 새로 부여해도 재로그인
전까지 반영되지 않는다. 관리자 API 는 호출 빈도가 낮아 조회 1회가 문제되지 않는다.

별도의 `is_admin` 불린 컬럼을 두지 않은 이유는, 같은 사실이 두 컬럼에 생기면
어긋날 수 있기 때문이다. `role` 은 나중에 `operator`, `partner` 같은 값을
추가하기도 쉽다.

응답 코드는 인증 실패(401)와 권한 없음(403)을 구분한다.

---

## 6. 알림

현재 고객에게 알릴 수단이 없다. 요청 접수와 처리 결과를 알리려면 채널이 필요하다.

- 1차: 예약 확인 화면에서 요청 상태를 직접 보여준다 (추가 비용 없음)
- 2차: 카카오 알림톡. 로그인이 카카오이므로 도달률이 가장 높다. 템플릿 승인에 리드타임이 있다
- 앱 연동 시 푸시로 대체 가능

---

## 7. 문의하기

예약 확인 화면의 "문의하기"는 상담 봇으로 처리한다. 별도 기획으로 다룬다.

변경 요청과 역할을 나눈다.

| | 변경 요청 | 문의하기 |
|---|---|---|
| 다루는 것 | 날짜·시간 변경 | 그 외 모든 문의 |
| 형태 | 정형 (날짜/시간/사유) | 자유 대화 |
| 기한 규칙 | 약관대로 적용 | 없음 |
| 당일 이후 | 불가 | 가능 — 당일 변경도 여기서 받는다 |

당일 변경은 약관상 "상황에 따라 가능"이므로 정형 요청으로 받지 않고 상담으로 넘긴다.

---

## 8. 남은 결정

1. **취소 정책** — 상품 약관 기준(5일)으로 통일했다. `/refund` 페이지, FAQ,
   `refund_service.py` 가 모두 같은 기준을 쓴다.
2. **승인 시 재검증** — 요청 접수 후 시간이 지나 기한이 지났을 때 승인할 수 있는지.
   현재는 운영자 재량으로 승인할 수 있다(규칙으로 막지 않는다).
3. **운영자 화면** — API 만 있고 화면은 없다. 당분간은 API 를 직접 호출해 처리한다.

---

## 9. 예약 상태와 환불

예약 상태는 다섯 가지이며, 허용된 전이만 가능하다.

```
pending   -> confirmed | rejected | cancelled
confirmed -> completed | cancelled
rejected / cancelled / completed 는 종결
```

결제는 상태를 바꾸지 않는다. 결제 승인은 `payment_status` 만 다루고,
확정 여부는 배차 확인 결과이므로 운영자가 정한다.

### 상태별 환불

"확정이 아니면 전액"으로 뭉뚱그리면 이미 이용을 마친 예약까지 전액 환불로
떨어진다. 상태별로 나눈다.

| 상태 | 환불 | 근거 |
|---|---|---|
| `pending` | 전액 | 배차가 잡히지 않았다 |
| `confirmed` | 5일 전까지 전액, 이후 없음 | 상품 약관 |
| `rejected` | 전액 | 배차 불가로 예약이 성립하지 않았다(이용약관 제7조) |
| `completed` | 없음 | 이미 이용했다 |
| `cancelled` | 없음 | 중복 환불 방지 |

### 지금은 결제와 연결하지 않는다

위 표는 **환불 규칙**이며, 아직 실제 결제취소와 연결하지 않았다.
결제가 라이브가 아니므로 취소·반려는 예약 상태만 바꾼다.

- 규칙은 `refund_service.calculate_refund_krw` 에 그대로 있다.
- 토스 결제취소 호출도 `refund_service.refund_for_cancellation` 에 준비돼 있으나
  어느 라우터에서도 호출하지 않는다.

결제를 붙일 때 두 취소 경로(고객 `PATCH /api/reservations/{번호}/cancel`,
운영자 `PATCH /api/admin/reservations/{번호}/status`)에서 호출하면 된다.
그때는 **환불을 먼저 처리하고 성공했을 때만 상태를 바꿔야 한다.**
반대로 하면 상태는 취소인데 결제는 남아 있는 상황이 생긴다.

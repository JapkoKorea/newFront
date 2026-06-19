# DB 설계 — 로컬 MySQL (코스 / 유저 / 예약·투어 기록 / 후기 / 송영 / 분석)

기존 스키마를 **확장**한다(재설계 아님). 현 컨벤션 유지: PK는 CHAR(36) UUID 또는 BIGINT AUTO_INCREMENT,
시간은 DATETIME(6), 엔진 InnoDB, charset utf8mb4, FK는 `fk_*`, 인덱스는 `idx_*`/`uq_*`.
환경변수: `MYSQL_HOST/USER/PASSWORD/DATABASE/PORT` (`backend/services/mysql_user_service.py`).

기존 테이블(유지): `users`, `auth_identities`, `reservations`, `reservation_payments`.
신규/변경은 아래에 표시. 분석 친화를 위해 **TEXT 덩어리(desired_course)를 정규화**하는 게 핵심.

---

## 0. 중요 — 이 DB는 LINE/카카오 챗 백엔드와 공유된다

라이브 확인(2026-06-19): MySQL `japko_local`(127.0.0.1:3306)에 두 백엔드가 **같은 DB를 공유**한다.
- `japan-taxi-tour/backend/` (이 프로젝트, 웹·모바일용)
- `japko/Backend/` (형제 디렉토리) — **LINE / 카카오 챗봇 기반 예약**. `routers/line.py`(webhook + LINE 발신), `routers/kakao_chat.py`, `services/chat_reservation_service.py`(LLM 챗 예약). Kafka·DynamoDB도 사용.

현재 라이브 테이블은 4개뿐: `users`(3행), `auth_identities`(3행), `reservations`(7행), `reservation_payments`(1행).
챗 백엔드가 `reservations`에 **컬럼을 이미 추가**해 둠:
- `source_channel VARCHAR(32)` (예: `line`, `kakao_chat`), `source_message_id VARCHAR(128)`, 유니크 인덱스 `uq_source_message(source_channel, source_message_id)` (챗 메시지 중복 예약 방지).

함의:
- **`users`/`reservations` 변경(ALTER)은 두 앱에 동시 영향.** role 추가 등은 양쪽 호환되게(추가 컬럼은 NULL/DEFAULT) 진행.
- 라이브 `users`에 `role` 컬럼 **없음** → 본 설계의 ALTER 필요(안전, 기존 행은 default 'customer').
- 분석의 "유입 채널"은 기존 `source_channel`을 표준으로 사용(값: web/app/line/kakao_chat). 단 taxi-tour의 현재 저장 경로는 `source_channel`을 채우지 않고 `created_at_source`에 값을 넣는데, 라이브 데이터를 보면 `created_at_source`에 타임스탬프가 잘못 들어간 행이 있어 **신뢰 불가**. → **(확정) taxi-tour 저장 시에도 `source_channel`(web/app)을 채우도록 통일**한다. `save_reservation_mysql`에 `source_channel` 인자 추가, 웹/모바일 예약 생성 경로에서 전달.

---

## 1. ERD (텍스트)

```
users 1---* auth_identities
users 1---* reservations
users 1---* favorites *---1 courses
users 1---* reviews

courses 1---* course_seasons
courses 1---* course_spots *---1 spots
courses 1---* course_images
courses 1---* reservations            (course_id, NULL이면 직접 만들기)
courses 1---* reviews                 (집계용, 직접 만들기는 NULL)

reservations 1---1 transfer_details   (service_type='transfer'일 때만)
reservations 1---* reservation_route_points *---0..1 spots
reservations 1---* reservation_quotes (송영 견적 이력)
reservations 1---* reservation_status_history
reservations 1---* reservation_payments (기존)
reservations 1---0..1 reviews
```

---

## 2. 마스터 — 코스 / 관광지

현재 코스는 Flutter `tour_course.dart`의 `tourCourses`와 웹 데이터에 하드코딩. 이를 DB로 이관해
홈 커머스 피드/상세/추천/집계의 단일 소스로 삼는다. 코스 `id`는 슬러그(딥링크 `/tours/:id`와 일치).

**시드 출처(확정):** 웹 `src/data/tourCourses.js`가 단일 소스(superset, 코스 10개 + 메타데이터).
Flutter `tour_course.dart`는 그 부분집합(6개)이라 폐기하고 API/DB를 읽도록 변경.
- `courses`/`course_seasons`/`course_spots` ← 웹 `tourCourses` (단, `id='custom'`은 "직접 만들기" 진입의 placeholder이므로 코스 row로 넣지 않음).
- `spots` ← 웹 `spotGuideData`(체류시간/시즌/포토포인트/인근) + 좌표는 Flutter 카탈로그(`tour_detail_page.dart`의 `_knownLocations`, `booking_shell_page.dart`의 `_locationCatalog`)에서 병합. `stayMinutes` 등은 `spots`에 컬럼 추가 또는 별도 `spot_guide` 보관.
- badge의 이모지(눈사람/꽃 등)는 시드 시 제거 → 텍스트만(예: '겨울 추천').

### 2.1 spots (관광지·역·공항·호텔 마스터)
Places 검색 결과와 하드코딩 카탈로그를 함께 수용. 분석의 "어디를 많이 가나" 기준점.
```sql
CREATE TABLE IF NOT EXISTS spots (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    name_ja VARCHAR(150) NULL,
    name_en VARCHAR(150) NULL,
    category VARCHAR(24) NOT NULL DEFAULT 'attraction', -- attraction|station|airport|hotel|other
    region VARCHAR(24) NULL,                            -- biei|furano|asahikawa|chitose|other
    lat DECIMAL(10,7) NULL,
    lng DECIMAL(10,7) NULL,
    google_place_id VARCHAR(255) NULL,
    address VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_spot_place (google_place_id),
    KEY idx_spot_category_region (category, region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.2 courses
```sql
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(64) NOT NULL,                 -- slug, 예: 'snow-drive'
    name VARCHAR(150) NOT NULL,
    summary VARCHAR(255) NULL,
    description TEXT NULL,
    region VARCHAR(24) NULL,
    departure_name VARCHAR(150) NULL,
    destination_name VARCHAR(150) NULL,
    duration_hours DECIMAL(4,1) NOT NULL DEFAULT 4.0,
    base_price_jpy INT UNSIGNED NULL,
    deposit_krw INT UNSIGNED NULL DEFAULT 15000,
    badge VARCHAR(40) NULL,                  -- 특가/인기 등
    hero_image_url VARCHAR(500) NULL,
    rating_avg DECIMAL(2,1) NOT NULL DEFAULT 0.0,   -- 비정규화 캐시
    rating_count INT UNSIGNED NOT NULL DEFAULT 0,   -- 비정규화 캐시
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_course_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 course_seasons (코스 다중 시즌)
```sql
CREATE TABLE IF NOT EXISTS course_seasons (
    course_id VARCHAR(64) NOT NULL,
    season VARCHAR(16) NOT NULL,             -- winter|summer|spring|autumn|all
    PRIMARY KEY (course_id, season),
    CONSTRAINT fk_cseason_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.4 course_spots (코스의 순서 있는 관광지)
```sql
CREATE TABLE IF NOT EXISTS course_spots (
    course_id VARCHAR(64) NOT NULL,
    seq SMALLINT UNSIGNED NOT NULL,
    spot_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (course_id, seq),
    KEY idx_cspot_spot (spot_id),
    CONSTRAINT fk_cspot_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_cspot_spot FOREIGN KEY (spot_id) REFERENCES spots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.5 course_images (갤러리)
```sql
CREATE TABLE IF NOT EXISTS course_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    course_id VARCHAR(64) NOT NULL,
    seq SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    url VARCHAR(500) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_cimg_course (course_id, seq),
    CONSTRAINT fk_cimg_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. 유저 — 확장 / 찜

### 3.1 users 확장 (ALTER)
기존: id, display_name, birthday, phone_number, timestamps. 추가:
```sql
ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'customer'; -- customer|admin (driver 추후)
ALTER TABLE users ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active'; -- active|dormant|withdrawn
ALTER TABLE users ADD COLUMN marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at DATETIME(6) NULL;
ALTER TABLE users ADD KEY idx_user_role (role);
```
`auth_identities`(기존)는 그대로 — 카카오 외 provider 확장 가능 구조라 유지. 관리자 로그인도
이 테이블 + `users.role`로 통합(별도 admin/staff 테이블 불필요). **지금은 role = customer | admin만 사용**:
신규 가입자는 `customer`, david 본인 계정만 카카오 로그인 후 `UPDATE users SET role='admin'`으로 승격.
기사(driver)는 추후 도입.

### 3.2 favorites (찜)
```sql
CREATE TABLE IF NOT EXISTS favorites (
    user_id CHAR(36) NOT NULL,
    course_id VARCHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, course_id),
    KEY idx_fav_course (course_id),
    CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fav_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
비로그인 찜은 클라이언트 로컬에 보관 후 로그인 시 서버 동기화.

---

## 4. 예약 / 투어 기록 (분석 핵심)

### 4.1 reservations 확장 (ALTER)
기존 컬럼 유지. 코스 연결 + 직접 만들기 플래그 추가:
```sql
ALTER TABLE reservations ADD COLUMN course_id VARCHAR(64) NULL;
ALTER TABLE reservations ADD COLUMN is_custom TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD CONSTRAINT fk_res_course
    FOREIGN KEY (course_id) REFERENCES courses(id);
ALTER TABLE reservations ADD KEY idx_res_service_status (service_type, status, created_at);
```
- `desired_course` TEXT는 **표시용 스냅샷**으로 유지(주문 시점 경로 보존). 분석은 아래 정규화 테이블 사용.
- `course_id` NULL + `is_custom=1` = 직접 만든 경로.

### 4.2 reservation_route_points (정규화된 경로 — 분석용)
`desired_course` TEXT를 대체하는 구조화 경로. service_type 무관(투어=출발+경유+도착, 송영=출발+도착).
```sql
CREATE TABLE IF NOT EXISTS reservation_route_points (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_number CHAR(36) NOT NULL,
    seq SMALLINT UNSIGNED NOT NULL,
    role VARCHAR(12) NOT NULL,            -- departure|waypoint|destination
    name VARCHAR(255) NOT NULL,
    lat DECIMAL(10,7) NULL,
    lng DECIMAL(10,7) NULL,
    google_place_id VARCHAR(255) NULL,
    spot_id BIGINT UNSIGNED NULL,         -- 마스터 매칭 시(분석 정확도 향상)
    PRIMARY KEY (id),
    UNIQUE KEY uq_route_seq (reservation_number, seq),
    KEY idx_route_spot (spot_id),
    KEY idx_route_place (google_place_id),
    CONSTRAINT fk_route_res FOREIGN KEY (reservation_number) REFERENCES reservations(reservation_number) ON DELETE CASCADE,
    CONSTRAINT fk_route_spot FOREIGN KEY (spot_id) REFERENCES spots(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
저장 시 Places 결과는 `spots`에 upsert(`google_place_id` 기준) 후 `spot_id` 연결 권장 → "인기 관광지" 집계 정확.

### 4.3 reservation_status_history (상태 변경 감사·퍼널 분석)
```sql
CREATE TABLE IF NOT EXISTS reservation_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_number CHAR(36) NOT NULL,
    from_status VARCHAR(32) NULL,
    to_status VARCHAR(32) NOT NULL,
    changed_by CHAR(36) NULL,             -- user/admin id
    reason VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_rsh_res (reservation_number, created_at),
    CONSTRAINT fk_rsh_res FOREIGN KEY (reservation_number) REFERENCES reservations(reservation_number) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.4 상태 라이프사이클
- 투어(tour): `pending -> confirmed(결제완료) -> completed` / `cancelled`
- 송영(transfer): `requested -> quoted -> accepted -> paid -> confirmed -> completed` / `declined` / `rejected` / `cancelled`
- payment_status(기존): `unpaid -> paid -> refunded`
status/payment_status는 VARCHAR 유지(기존과 호환). 애플리케이션 레벨에서 enum 검증.

---

## 5. 송영(transfer) 데이터 모델

송영은 공항<->호텔 점대점. 투어 컬럼(관광지/코스)이 불필요하므로 1:1 상세 테이블로 분리해
`reservations`의 nullable 비대를 방지.
```sql
CREATE TABLE IF NOT EXISTS transfer_details (
    reservation_number CHAR(36) NOT NULL,
    direction VARCHAR(20) NOT NULL,        -- airport_to_hotel|hotel_to_airport
    airport_code VARCHAR(8) NOT NULL DEFAULT 'CTS', -- CTS(신치토세), AKJ(아사히카와) 등
    airport_name VARCHAR(100) NULL,
    hotel_name VARCHAR(200) NOT NULL,
    hotel_address VARCHAR(255) NULL,
    hotel_place_id VARCHAR(255) NULL,
    hotel_lat DECIMAL(10,7) NULL,
    hotel_lng DECIMAL(10,7) NULL,
    flight_number VARCHAR(20) NULL,        -- 픽업 타이밍용(선택)
    luggage_count SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- 차량 크기 산정
    special_request TEXT NULL,
    PRIMARY KEY (reservation_number),
    CONSTRAINT fk_transfer_res FOREIGN KEY (reservation_number) REFERENCES reservations(reservation_number) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
출발/도착 좌표는 `reservation_route_points`에도 2행(departure/destination)으로 기록 → 송영도 동일 분석 파이프라인.

### 5.1 reservation_quotes (기사 견적 이력)
`reservations`의 quote_* 컬럼은 "현재 견적" 빠른 조회용으로 유지하되, 모든 제시 이력을 별도 테이블로.
```sql
CREATE TABLE IF NOT EXISTS reservation_quotes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_number CHAR(36) NOT NULL,
    quoted_price_jpy INT UNSIGNED NOT NULL,
    deposit_krw INT UNSIGNED NOT NULL,
    quote_note TEXT NULL,
    quoted_by CHAR(36) NULL,               -- admin user id (기사 추후)
    status VARCHAR(16) NOT NULL DEFAULT 'offered', -- offered|accepted|declined|expired|superseded
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_quote_res (reservation_number, created_at),
    CONSTRAINT fk_quote_res FOREIGN KEY (reservation_number) REFERENCES reservations(reservation_number) ON DELETE CASCADE,
    CONSTRAINT fk_quote_by FOREIGN KEY (quoted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
`TODO_ADMIN_QUOTE.md`의 관리자 견적 기능이 이 테이블 위에서 동작.

---

## 6. 후기 / 별점

### 6.1 reviews
완료된 예약당 1건. 직접 만들기 예약은 `course_id` NULL(집계 제외, 후기 자체는 가능).
```sql
CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_number CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    course_id VARCHAR(64) NULL,
    rating TINYINT UNSIGNED NOT NULL,      -- 1..5
    content TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'visible', -- visible|hidden|reported
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_review_reservation (reservation_number),
    KEY idx_review_course (course_id, status, created_at),
    KEY idx_review_user (user_id, created_at),
    CONSTRAINT fk_review_res FOREIGN KEY (reservation_number) REFERENCES reservations(reservation_number),
    CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_review_course FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
작성 자격: 예약 status가 completed일 때만(앱 레벨 검증). 집계는 `courses.rating_avg/rating_count`를
리뷰 생성/수정/숨김 시 갱신(앱 로직 또는 트리거).

### 6.2 review_images
```sql
CREATE TABLE IF NOT EXISTS review_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    review_id BIGINT UNSIGNED NOT NULL,
    seq SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    url VARCHAR(500) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_rimg_review (review_id, seq),
    CONSTRAINT fk_rimg_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 7. 분석 관점 (왜 이렇게 정규화했나 + 예시)

핵심: 주문 시점 표시는 스냅샷(desired_course/transfer_details)으로, **분석은 정규화 테이블**로.

대표 분석 질문과 소스:
- 인기 관광지 Top N: `reservation_route_points` (role='waypoint') GROUP BY spot_id.
- 시즌별 예약 분포: `reservations.season` 또는 `course_seasons` 조인.
- 코스별 전환율(조회 대비 예약): 이벤트 로그 필요(8장 선택) + reservations.
- 코스별 만족도: `reviews` GROUP BY course_id (rating_avg).
- 매출/결제 성공률: `reservation_payments` status 집계.
- 송영 견적 수락률: `reservation_quotes.status` + 상태 이력.
- 퍼널(생성->결제): `reservation_status_history` 단계 전이 시간.

예시 뷰:
```sql
CREATE OR REPLACE VIEW v_popular_spots AS
SELECT s.id, s.name, COUNT(*) AS visit_count
FROM reservation_route_points rp
JOIN spots s ON s.id = rp.spot_id
WHERE rp.role = 'waypoint'
GROUP BY s.id, s.name
ORDER BY visit_count DESC;

CREATE OR REPLACE VIEW v_reservation_facts AS
SELECT r.reservation_number, r.service_type, r.status, r.season,
       r.course_id, c.name AS course_name, r.number_of_people,
       r.tour_date, r.created_at,
       p.amount_krw, p.status AS payment_status
FROM reservations r
LEFT JOIN courses c ON c.id = r.course_id
LEFT JOIN reservation_payments p ON p.reservation_number = r.reservation_number
   AND p.status = 'paid';
```

---

## 8. (선택) 제품 이벤트 로그 — 퍼널/행동 분석

조회->빌더->예약 전환 등 행동 분석을 하려면 별도 이벤트 테이블 권장(없으면 전환율 분석 불가).
```sql
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id CHAR(36) NULL,                 -- 비로그인 NULL
    anon_id VARCHAR(64) NULL,              -- 비로그인 식별(클라이언트 생성)
    event_name VARCHAR(48) NOT NULL,       -- course_view|builder_open|booking_start|booking_submit|...
    course_id VARCHAR(64) NULL,
    props_json JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_evt_name_time (event_name, created_at),
    KEY idx_evt_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
초기엔 보류 가능. 단, "코스 전환율"을 보고 싶다면 1차부터 최소 이벤트(course_view, booking_submit)만이라도 적재 권장.

---

## 9. 마이그레이션 / 적용 순서

기존 코드가 startup에서 `ensure_*_tables()`로 DDL을 실행하므로 동일 패턴으로 추가.
1. `spots`, `courses`, `course_seasons`, `course_spots`, `course_images` 생성 + 시드(하드코딩 코스 이관).
2. `users` ALTER(email/role/status/...), `favorites` 생성.
3. `reservations` ALTER(course_id/is_custom/FK), `reservation_route_points`, `reservation_status_history` 생성.
4. `transfer_details`, `reservation_quotes` 생성(송영 + 관리자 견적).
5. `reviews`, `review_images` 생성 + `courses.rating_*` 갱신 로직.
6. (선택) `analytics_events`.
7. 저장 경로 수정: 예약 생성 시 `desired_course` TEXT와 함께 `reservation_route_points` 동시 기록,
   Places 스팟은 `spots` upsert. 상태 변경 시 `reservation_status_history` 기록.
   **`save_reservation_mysql`에 `source_channel` 인자 추가**, 웹='web' / 모바일='app'로 채워 채널 분석 통일.

서비스 함수 신규(예): `ensure_catalog_tables()`, `ensure_review_tables()`, `save_route_points()`,
`record_status_change()`, `upsert_spot_by_place_id()`. 라우터는 얇게, 로직은 `services/`(백엔드 규칙).

---

## 10. 열린 질문

1. (해결) 코스 시드 = 웹 `src/data/tourCourses.js`(superset). Flutter는 부분집합이라 폐기→API. 좌표만 Flutter 카탈로그 병합. 2장 참고.
2. 후기 사진 업로드 저장소: 로컬 디스크 / S3 호환 / 외부 CDN 중?
3. (해결) 기사 계정 없음 — 지금은 customer + admin(david)만. `users.role` customer/admin. 기사는 추후.
4. 다국어(name_ja/name_en) 실제로 쓸지(일본 현지/영문 응대), 아니면 한국어만?
5. `analytics_events`를 1차에 넣을지(전환율 분석 필요 여부).

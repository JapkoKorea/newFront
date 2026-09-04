from typing import Any

from services.mysql_user_service import _connect


def ensure_reservation_tables() -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reservations (
                    reservation_number CHAR(36) NOT NULL,
                    user_id CHAR(36) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    service_type VARCHAR(16) NOT NULL DEFAULT 'tour',
                    season VARCHAR(16) NULL,
                    english_name VARCHAR(100) NOT NULL,
                    contact_number VARCHAR(32) NOT NULL,
                    tour_date DATE NOT NULL,
                    tour_start_time TIME NOT NULL,
                    tour_duration_hours DECIMAL(4,1) NOT NULL,
                    number_of_people SMALLINT UNSIGNED NOT NULL,
                    departure VARCHAR(255) NOT NULL,
                    destination VARCHAR(255) NOT NULL,
                    desired_course TEXT NOT NULL,
                    payment_status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
                    payment_amount_krw INT UNSIGNED NULL,
                    payment_updated_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    created_at_source VARCHAR(32) NULL,
                    PRIMARY KEY (reservation_number),
                    KEY idx_res_user_created (user_id, created_at),
                    KEY idx_res_status_created (status, created_at),
                    CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 기존 테이블에 신규 컬럼 추가 (이미 존재하면 무시)
            for ddl in [
                "ALTER TABLE reservations ADD COLUMN service_type VARCHAR(16) NOT NULL DEFAULT 'tour'",
                "ALTER TABLE reservations ADD COLUMN season VARCHAR(16) NULL",
                "ALTER TABLE reservations ADD COLUMN quoted_price_jpy INT UNSIGNED NULL",
                "ALTER TABLE reservations ADD COLUMN deposit_krw INT UNSIGNED NULL",
                "ALTER TABLE reservations ADD COLUMN quoted_at DATETIME(6) NULL",
                "ALTER TABLE reservations ADD COLUMN quote_expires_at DATETIME(6) NULL",
                "ALTER TABLE reservations ADD COLUMN quote_note TEXT NULL",
                # 정규화/분석 (DB_DESIGN.md 4장)
                "ALTER TABLE reservations ADD COLUMN course_id VARCHAR(64) NULL",
                "ALTER TABLE reservations ADD COLUMN is_custom TINYINT(1) NOT NULL DEFAULT 0",
                # 유입 채널 (LINE 백엔드가 이미 추가했을 수 있으나 idempotent)
                "ALTER TABLE reservations ADD COLUMN source_channel VARCHAR(32) NULL",
                "ALTER TABLE reservations ADD KEY idx_res_service_status (service_type, status, created_at)",
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass  # 컬럼/인덱스가 이미 존재하는 경우 무시
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reservation_payments (
                    order_id VARCHAR(64) NOT NULL,
                    reservation_number CHAR(36) NOT NULL,
                    user_id CHAR(36) NOT NULL,
                    amount_krw INT UNSIGNED NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    payment_key VARCHAR(200) NULL,
                    method VARCHAR(50) NULL,
                    raw_response_json LONGTEXT NULL,
                    failure_code VARCHAR(120) NULL,
                    failure_message TEXT NULL,
                    approved_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (order_id),
                    KEY idx_reservation_payment (reservation_number, created_at),
                    KEY idx_user_payment (user_id, created_at),
                    CONSTRAINT fk_payment_reservation FOREIGN KEY (reservation_number) REFERENCES reservations(reservation_number),
                    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 정규화된 경로(분석용) — DB_DESIGN.md 4.2
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reservation_route_points (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    reservation_number CHAR(36) NOT NULL,
                    seq SMALLINT UNSIGNED NOT NULL,
                    role VARCHAR(12) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    lat DECIMAL(10,7) NULL,
                    lng DECIMAL(10,7) NULL,
                    google_place_id VARCHAR(255) NULL,
                    spot_id BIGINT UNSIGNED NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_route_seq (reservation_number, seq),
                    KEY idx_route_spot (spot_id),
                    KEY idx_route_place (google_place_id),
                    CONSTRAINT fk_route_res FOREIGN KEY (reservation_number)
                        REFERENCES reservations(reservation_number) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 상태 변경 이력(감사/퍼널 분석) — DB_DESIGN.md 4.3
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reservation_status_history (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    reservation_number CHAR(36) NOT NULL,
                    from_status VARCHAR(32) NULL,
                    to_status VARCHAR(32) NOT NULL,
                    changed_by CHAR(36) NULL,
                    reason VARCHAR(255) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_rsh_res (reservation_number, created_at),
                    CONSTRAINT fk_rsh_res FOREIGN KEY (reservation_number)
                        REFERENCES reservations(reservation_number) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 예약 변경 요청 — RESERVATION_CHANGE_PLAN.md
            # 즉시 반영이 아니라 "신청"을 쌓아두고 운영자가 처리한다.
            # 요청 시점의 일정을 함께 남겨, 나중에 원본이 바뀌어도 무엇을
            # 무엇으로 바꿔달라고 했는지 추적할 수 있게 한다.
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reservation_change_requests (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    reservation_number CHAR(36) NOT NULL,
                    user_id CHAR(36) NOT NULL,
                    request_type VARCHAR(16) NOT NULL,
                    current_tour_date DATE NOT NULL,
                    current_tour_start_time TIME NOT NULL,
                    requested_tour_date DATE NULL,
                    requested_tour_start_time TIME NULL,
                    reason TEXT NULL,
                    status VARCHAR(16) NOT NULL DEFAULT 'pending',
                    admin_note TEXT NULL,
                    resolved_by CHAR(36) NULL,
                    resolved_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_rcr_res (reservation_number, created_at),
                    KEY idx_rcr_user (user_id, created_at),
                    KEY idx_rcr_status (status, created_at),
                    CONSTRAINT fk_rcr_res FOREIGN KEY (reservation_number)
                        REFERENCES reservations(reservation_number) ON DELETE CASCADE,
                    CONSTRAINT fk_rcr_user FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
        conn.commit()
    finally:
        conn.close()


def _resolve_spot_id(
    cursor: Any,
    name: str,
    lat: float | None,
    lng: float | None,
    google_place_id: str | None,
) -> int | None:
    """경로 지점을 spots 마스터에 매칭/업서트하고 spot_id 반환(분석 정확도용)."""
    if google_place_id:
        cursor.execute(
            "SELECT id FROM spots WHERE google_place_id = %s LIMIT 1", (google_place_id,)
        )
        row = cursor.fetchone()
        if row:
            return row["id"]
        cursor.execute(
            "INSERT INTO spots (name, category, lat, lng, google_place_id) VALUES (%s, 'other', %s, %s, %s)",
            (name, lat, lng, google_place_id),
        )
        return cursor.lastrowid
    if name:
        cursor.execute("SELECT id FROM spots WHERE name = %s LIMIT 1", (name,))
        row = cursor.fetchone()
        if row:
            return row["id"]
    return None


def _build_route_points(data: dict[str, Any]) -> list[dict[str, Any]]:
    """departure + selectedSpots(경유) + destination 으로 정규화 경로 구성."""
    points: list[dict[str, Any]] = []
    departure = (data.get("departure") or "").strip()
    if departure:
        points.append({"role": "departure", "name": departure})
    for spot in data.get("selectedSpots") or []:
        if isinstance(spot, dict):
            name = (spot.get("name") or "").strip()
            if not name:
                continue
            points.append(
                {
                    "role": "waypoint",
                    "name": name,
                    "lat": spot.get("lat"),
                    "lng": spot.get("lng"),
                    "google_place_id": spot.get("googlePlaceId") or spot.get("google_place_id"),
                }
            )
        elif isinstance(spot, str) and spot.strip():
            points.append({"role": "waypoint", "name": spot.strip()})
    destination = (data.get("destination") or "").strip()
    if destination:
        points.append({"role": "destination", "name": destination})
    return points


def record_status_change(
    cursor: Any,
    reservation_number: str,
    from_status: str | None,
    to_status: str,
    changed_by: str | None = None,
    reason: str | None = None,
) -> None:
    cursor.execute(
        """
        INSERT INTO reservation_status_history
            (reservation_number, from_status, to_status, changed_by, reason)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (reservation_number, from_status, to_status, changed_by, reason),
    )


def save_reservation_mysql(data: dict[str, Any]) -> None:
    reservation_number = data["reservationNumber"]
    status = data["status"]
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reservations (
                    reservation_number,
                    user_id,
                    status,
                    service_type,
                    season,
                    english_name,
                    contact_number,
                    tour_date,
                    tour_start_time,
                    tour_duration_hours,
                    number_of_people,
                    departure,
                    destination,
                    desired_course,
                    course_id,
                    is_custom,
                    source_channel,
                    created_at_source
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    reservation_number,
                    data["pk"],
                    status,
                    data.get("serviceType", "tour"),
                    data.get("season"),
                    data["englishName"],
                    data["phoneNumber"],
                    data["tourDate"],
                    data["tourStartTime"],
                    data["tourDuration"],
                    data["numberOfPeople"],
                    data["departure"],
                    data["destination"],
                    data["tourCourse"],
                    data.get("courseId"),
                    1 if data.get("isCustom") else 0,
                    data.get("sourceChannel", "web"),
                    data.get("createdAt"),
                ),
            )

            # 정규화 경로 기록 (분석용)
            for seq, point in enumerate(_build_route_points(data), start=1):
                spot_id = _resolve_spot_id(
                    cursor,
                    point["name"],
                    point.get("lat"),
                    point.get("lng"),
                    point.get("google_place_id"),
                )
                cursor.execute(
                    """
                    INSERT INTO reservation_route_points
                        (reservation_number, seq, role, name, lat, lng, google_place_id, spot_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        reservation_number,
                        seq,
                        point["role"],
                        point["name"],
                        point.get("lat"),
                        point.get("lng"),
                        point.get("google_place_id"),
                        spot_id,
                    ),
                )

            # 최초 상태 이력
            record_status_change(
                cursor,
                reservation_number,
                None,
                status,
                changed_by=data["pk"],
                reason="created",
            )
        conn.commit()
    finally:
        conn.close()

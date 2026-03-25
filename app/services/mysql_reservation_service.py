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
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass  # 컬럼이 이미 존재하는 경우 무시
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
        conn.commit()
    finally:
        conn.close()


def save_reservation_mysql(data: dict[str, Any]) -> None:
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
                    created_at_source
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    data["reservationNumber"],
                    data["pk"],
                    data["status"],
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
                    data.get("createdAt"),
                ),
            )
        conn.commit()
    finally:
        conn.close()

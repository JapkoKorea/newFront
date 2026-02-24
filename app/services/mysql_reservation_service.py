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
                    english_name VARCHAR(100) NOT NULL,
                    contact_number VARCHAR(32) NOT NULL,
                    tour_date DATE NOT NULL,
                    tour_start_time TIME NOT NULL,
                    tour_duration_hours DECIMAL(4,1) NOT NULL,
                    number_of_people SMALLINT UNSIGNED NOT NULL,
                    departure VARCHAR(255) NOT NULL,
                    destination VARCHAR(255) NOT NULL,
                    desired_course TEXT NOT NULL,
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
        conn.commit()
    finally:
        conn.close()


def save_reservation_mysql(data: dict) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reservations (
                    reservation_number,
                    user_id,
                    status,
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
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    data["reservationNumber"],
                    data["pk"],
                    data["status"],
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

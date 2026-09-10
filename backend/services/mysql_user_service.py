import os
import uuid

import pymysql
from pymysql.cursors import DictCursor


def _mysql_config() -> dict:
    host = os.getenv("MYSQL_HOST")
    user = os.getenv("MYSQL_USER")
    password = os.getenv("MYSQL_PASSWORD")
    database = os.getenv("MYSQL_DATABASE")
    port = int(os.getenv("MYSQL_PORT", "3306"))

    missing = [
        name
        for name, value in (
            ("MYSQL_HOST", host),
            ("MYSQL_USER", user),
            ("MYSQL_PASSWORD", password),
            ("MYSQL_DATABASE", database),
        )
        if not value
    ]
    if missing:
        raise ValueError(f"Missing MySQL environment variables: {', '.join(missing)}")

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "database": database,
        "charset": "utf8mb4",
        "autocommit": False,
        "cursorclass": DictCursor,
    }


def _connect():
    return pymysql.connect(**_mysql_config())


def ensure_user_tables() -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id CHAR(36) NOT NULL,
                    display_name VARCHAR(100) NULL,
                    email VARCHAR(255) NULL,
                    birthday VARCHAR(20) NULL,
                    phone_number VARCHAR(30) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_identities (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    user_id CHAR(36) NOT NULL,
                    provider VARCHAR(32) NOT NULL,
                    provider_user_id VARCHAR(64) NOT NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    last_login_at DATETIME(6) NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_provider_subject (provider, provider_user_id),
                    UNIQUE KEY uq_user_provider (user_id, provider),
                    KEY idx_auth_user (user_id),
                    CONSTRAINT fk_auth_user FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 이미 만들어진 표에도 붙인다. 알림 메일을 보내려면 주소가 필요한데,
            # 그동안 카카오가 준 이메일을 받아서 그냥 버리고 있었다.
            cursor.execute(
                """
                SELECT COUNT(*) AS n FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email'
                """
            )
            if not cursor.fetchone()["n"]:
                cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL AFTER display_name")
        conn.commit()
    finally:
        conn.close()


def upsert_oauth_user(
    provider: str,
    provider_user_id: str,
    display_name: str,
    email: str | None = None,
) -> str:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id, u.display_name, u.email
                FROM auth_identities ai
                JOIN users u ON u.id = ai.user_id
                WHERE ai.provider = %s AND ai.provider_user_id = %s
                LIMIT 1
                """,
                (provider, provider_user_id),
            )
            existing = cursor.fetchone()

            if existing:
                user_id = existing["id"]
                cursor.execute(
                    """
                    UPDATE auth_identities
                    SET last_login_at = UTC_TIMESTAMP(6)
                    WHERE provider = %s AND provider_user_id = %s
                    """,
                    (provider, provider_user_id),
                )
                if display_name and display_name != (existing.get("display_name") or ""):
                    cursor.execute(
                        "UPDATE users SET display_name = %s WHERE id = %s",
                        (display_name, user_id),
                    )
                # 이메일은 카카오 동의 항목이라 나중에 켜질 수 있다. 값이 올 때마다
                # 갱신하되, 빈 값으로 기존 주소를 지우지는 않는다.
                if email:
                    cursor.execute(
                        "UPDATE users SET email = %s WHERE id = %s AND (email IS NULL OR email <> %s)",
                        (email, user_id, email),
                    )
                conn.commit()
                return user_id

            user_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO users (id, display_name, email, birthday, phone_number)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, display_name or "Unknown", email or None, "", ""),
            )
            cursor.execute(
                """
                INSERT INTO auth_identities (user_id, provider, provider_user_id, last_login_at)
                VALUES (%s, %s, %s, UTC_TIMESTAMP(6))
                """,
                (user_id, provider, provider_user_id),
            )
            conn.commit()
            return user_id
    finally:
        conn.close()


def get_user_email(user_id: str) -> str:
    """알림을 보낼 주소. 없으면 빈 문자열.

    카카오 이메일 동의를 하지 않은 사용자는 주소가 없다. 그건 오류가 아니라
    흔한 경우이므로, 호출부는 빈 문자열을 받으면 그냥 건너뛴다.
    """
    if not user_id:
        return ""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT email FROM users WHERE id = %s LIMIT 1", (user_id,))
            row = cursor.fetchone()
    finally:
        conn.close()
    return (row or {}).get("email") or ""

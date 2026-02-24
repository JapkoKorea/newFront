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
        conn.commit()
    finally:
        conn.close()


def upsert_oauth_user(provider: str, provider_user_id: str, display_name: str) -> str:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id, u.display_name
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
                conn.commit()
                return user_id

            user_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO users (id, display_name, birthday, phone_number)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, display_name or "Unknown", "", ""),
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

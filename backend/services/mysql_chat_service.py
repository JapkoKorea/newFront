"""상담 채팅 저장/조회 서비스.

conversations / messages 테이블을 사용한다. 관리자는 공유 DB(japko_local)를 보는
기존 LINE/카카오 챗 백엔드에서 답장을 쓸 수 있으므로, 예약 서비스와 동일한
'공유 DB 공존' 패턴(CREATE IF NOT EXISTS + 누락 컬럼 idempotent ALTER)을 따른다.

메시지 폴링은 AUTO_INCREMENT `id`를 커서로 사용한다 (GET ...?after=<last_id>).
"""

import uuid
from typing import Any

from services.mysql_user_service import _connect


def ensure_chat_tables() -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id CHAR(36) NOT NULL,
                    user_id CHAR(36) NOT NULL,
                    channel VARCHAR(16) NOT NULL DEFAULT 'web',
                    reservation_number CHAR(36) NULL,
                    status VARCHAR(16) NOT NULL DEFAULT 'open',
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_conv_user_status (user_id, status, updated_at),
                    KEY idx_conv_reservation (reservation_number),
                    CONSTRAINT fk_conv_user FOREIGN KEY (user_id) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 공유 DB에 이미 테이블이 있을 경우 누락 컬럼만 보강 (idempotent)
            for ddl in [
                "ALTER TABLE conversations ADD COLUMN channel VARCHAR(16) NOT NULL DEFAULT 'web'",
                "ALTER TABLE conversations ADD COLUMN reservation_number CHAR(36) NULL",
                "ALTER TABLE conversations ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'open'",
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    conversation_id CHAR(36) NOT NULL,
                    sender VARCHAR(16) NOT NULL,
                    body TEXT NOT NULL,
                    read_at DATETIME(6) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_msg_conv_id (conversation_id, id),
                    CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id)
                        REFERENCES conversations(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            for ddl in [
                "ALTER TABLE messages ADD COLUMN read_at DATETIME(6) NULL",
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass
        conn.commit()
    finally:
        conn.close()


def _serialize_conversation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "channel": row.get("channel", "web"),
        "reservationNumber": row.get("reservation_number"),
        "status": row.get("status", "open"),
    }


def _serialize_message(row: dict[str, Any]) -> dict[str, Any]:
    created = row.get("created_at")
    return {
        "id": row["id"],
        "conversationId": row["conversation_id"],
        "sender": row["sender"],
        "body": row["body"],
        "createdAt": created.isoformat() if created is not None else None,
    }


def get_or_create_open_conversation(
    user_id: str,
    reservation_number: str | None = None,
) -> dict[str, Any]:
    """유저의 열린(open) 대화를 반환하거나 없으면 생성한다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM conversations
                WHERE user_id = %s AND status = 'open'
                  AND (%s IS NULL OR reservation_number <=> %s)
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (user_id, reservation_number, reservation_number),
            )
            row = cursor.fetchone()
            if row:
                return _serialize_conversation(row)

            conversation_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO conversations (id, user_id, channel, reservation_number, status)
                VALUES (%s, %s, 'web', %s, 'open')
                """,
                (conversation_id, user_id, reservation_number),
            )
        conn.commit()
        return {
            "id": conversation_id,
            "userId": user_id,
            "channel": "web",
            "reservationNumber": reservation_number,
            "status": "open",
        }
    finally:
        conn.close()


def _conversation_belongs_to_user(cursor: Any, conversation_id: str, user_id: str) -> bool:
    cursor.execute(
        "SELECT id FROM conversations WHERE id = %s AND user_id = %s LIMIT 1",
        (conversation_id, user_id),
    )
    return cursor.fetchone() is not None


def list_messages(
    conversation_id: str,
    user_id: str,
    after_id: int = 0,
) -> list[dict[str, Any]]:
    """대화의 메시지를 after_id 이후로 조회 (폴링용). 소유자 검증 포함."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            if not _conversation_belongs_to_user(cursor, conversation_id, user_id):
                return []
            cursor.execute(
                """
                SELECT * FROM messages
                WHERE conversation_id = %s AND id > %s
                ORDER BY id ASC
                LIMIT 200
                """,
                (conversation_id, after_id),
            )
            return [_serialize_message(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def create_message(
    conversation_id: str,
    user_id: str,
    body: str,
    sender: str = "user",
) -> dict[str, Any] | None:
    """메시지를 저장한다. 대화 소유자가 아니면 None."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            if not _conversation_belongs_to_user(cursor, conversation_id, user_id):
                return None
            cursor.execute(
                """
                INSERT INTO messages (conversation_id, sender, body)
                VALUES (%s, %s, %s)
                """,
                (conversation_id, sender, body),
            )
            message_id = cursor.lastrowid
            # 대화 updated_at 갱신 (정렬/알림용)
            cursor.execute(
                "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP(6) WHERE id = %s",
                (conversation_id,),
            )
            cursor.execute("SELECT * FROM messages WHERE id = %s", (message_id,))
            row = cursor.fetchone()
        conn.commit()
        return _serialize_message(row) if row else None
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 운영자용
# ---------------------------------------------------------------------------

def list_conversations_for_admin(
    only_unanswered: bool = False,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """운영자 인박스 목록.

    "미답변"은 별도 컬럼을 두지 않고 계산한다. 마지막 사람 메시지 이후에
    운영자 답변이 없으면 미답변이다. 봇 응답은 사람 답변으로 치지 않는다.
    상태 컬럼을 따로 두면 메시지와 어긋날 수 있어 메시지에서 직접 판정한다.
    """
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id, c.user_id, c.channel, c.reservation_number, c.status,
                       c.created_at, c.updated_at,
                       u.display_name AS user_display_name,
                       (SELECT body FROM messages m WHERE m.conversation_id = c.id
                         ORDER BY m.id DESC LIMIT 1) AS last_body,
                       (SELECT sender FROM messages m WHERE m.conversation_id = c.id
                         ORDER BY m.id DESC LIMIT 1) AS last_sender,
                       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
                       (SELECT MAX(m.id) FROM messages m
                         WHERE m.conversation_id = c.id AND m.sender = 'user') AS last_user_id,
                       (SELECT MAX(m.id) FROM messages m
                         WHERE m.conversation_id = c.id AND m.sender = 'admin') AS last_admin_id
                FROM conversations c
                JOIN users u ON u.id = c.user_id
                ORDER BY c.updated_at DESC
                LIMIT %s
                """,
                (int(limit),),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    result = []
    for row in rows:
        last_user = row.get("last_user_id") or 0
        last_admin = row.get("last_admin_id") or 0
        unanswered = last_user > last_admin

        if only_unanswered and not unanswered:
            continue

        item = _serialize_conversation(row)
        item.update(
            {
                "userDisplayName": row.get("user_display_name"),
                "lastBody": row.get("last_body"),
                "lastSender": row.get("last_sender"),
                "messageCount": row.get("message_count"),
                "unanswered": unanswered,
            }
        )
        result.append(item)
    return result


def list_messages_for_admin(conversation_id: str, after_id: int = 0) -> list[dict[str, Any]]:
    """운영자는 소유자 확인 없이 대화를 볼 수 있다(권한은 라우터에서 검사)."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, conversation_id, sender, body, created_at
                FROM messages
                WHERE conversation_id = %s AND id > %s
                ORDER BY id
                """,
                (conversation_id, int(after_id)),
            )
            return [_serialize_message(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def create_admin_message(conversation_id: str, body: str) -> dict[str, Any] | None:
    """운영자 답변을 남긴다. 없는 대화면 None."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM conversations WHERE id = %s LIMIT 1", (conversation_id,))
            if cursor.fetchone() is None:
                return None

            cursor.execute(
                "INSERT INTO messages (conversation_id, sender, body) VALUES (%s, 'admin', %s)",
                (conversation_id, body),
            )
            message_id = cursor.lastrowid
            cursor.execute(
                "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP(6) WHERE id = %s",
                (conversation_id,),
            )
            cursor.execute(
                "SELECT id, conversation_id, sender, body, created_at FROM messages WHERE id = %s",
                (message_id,),
            )
            row = cursor.fetchone()
        conn.commit()
        return _serialize_message(row) if row else None
    finally:
        conn.close()

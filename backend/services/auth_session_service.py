"""리프레시 토큰 저장소.

액세스 토큰(JWT)은 서명만 맞으면 통과하므로 서버가 도중에 취소할 수 없다.
그래서 수명을 짧게(30분) 두고, 그보다 오래 가는 리프레시 토큰을 DB 에 기록해
"살아 있는 세션"의 기준으로 삼는다. 로그아웃과 강제 만료는 이 표를 지우는
것으로 처리한다.

토큰 원문은 저장하지 않는다. DB 가 새어도 그 값으로 로그인할 수 없도록
sha256 해시만 남긴다. 원문은 httpOnly 쿠키로만 오간다.

재사용 감지: 회전(rotation)한 토큰이 다시 들어오면 탈취를 의심한다. 정상적인
클라이언트는 회전 직후의 새 토큰만 들고 있기 때문이다. 이때는 해당 세션 하나가
아니라 같은 family(로그인 한 번에서 이어진 회전 사슬) 전체를 끊는다.
"""

import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from services.mysql_user_service import _connect


# 리프레시 토큰 수명. 이 기간 동안 재방문이 없으면 다시 로그인해야 한다.
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))

# 회전 직후 짧은 유예. 새 토큰을 받는 응답이 유실되거나(네트워크 끊김),
# 탭 두 개가 동시에 갱신을 걸면 방금 회전한 토큰이 다시 들어온다. 이걸 전부
# 탈취로 보면 정상 사용자가 로그아웃된다.
#
# 다만 이 창 안에서는 토큰을 다시 보낸 쪽이 세션을 가져간다 — 훔친 토큰을
# 이 안에 쓰면 원래 사용자를 밀어낼 수 있다는 뜻이다. 원문을 저장하지 않는
# 이상 피할 수 없으므로 창을 짧게 둔다. 정상 재시도는 수백 ms 안에 온다.
ROTATION_GRACE_SECONDS = int(os.getenv("REFRESH_ROTATION_GRACE_SECONDS", "10"))


def _hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    # DB 컬럼이 naive DATETIME 이므로 tz 를 떼고 UTC 기준으로 맞춘다.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def ensure_auth_session_tables() -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id CHAR(36) NOT NULL,
                    family_id CHAR(36) NOT NULL,
                    user_id CHAR(36) NOT NULL,
                    token_hash CHAR(64) NOT NULL,
                    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    expires_at DATETIME(6) NOT NULL,
                    rotated_at DATETIME(6) NULL,
                    revoked_at DATETIME(6) NULL,
                    user_agent VARCHAR(255) NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_auth_sessions_token (token_hash),
                    KEY idx_auth_sessions_family (family_id),
                    KEY idx_auth_sessions_user (user_id),
                    KEY idx_auth_sessions_expires (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
        conn.commit()
    finally:
        conn.close()


def _insert(cursor, user_id: str, family_id: str, user_agent: str | None) -> tuple[str, datetime]:
    raw_token = secrets.token_urlsafe(48)
    expires_at = _utcnow() + timedelta(days=REFRESH_TOKEN_DAYS)
    cursor.execute(
        """
        INSERT INTO auth_sessions (id, family_id, user_id, token_hash, expires_at, user_agent)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            str(uuid.uuid4()),
            family_id,
            user_id,
            _hash(raw_token),
            expires_at,
            (user_agent or "")[:255] or None,
        ),
    )
    return raw_token, expires_at


def create_session(user_id: str, user_agent: str | None = None) -> tuple[str, datetime]:
    """새 로그인. 새 family 를 연다. (원문 토큰, 만료시각) 을 돌려준다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            raw_token, expires_at = _insert(cursor, user_id, str(uuid.uuid4()), user_agent)
        conn.commit()
        return raw_token, expires_at
    finally:
        conn.close()


def rotate_session(raw_token: str, user_agent: str | None = None) -> dict[str, Any] | None:
    """리프레시 토큰을 새 것으로 바꾼다.

    성공하면 {user_id, token, expires_at}, 실패하면 None.
    실패는 없는 토큰 / 만료 / 취소된 토큰 / 재사용 감지를 모두 포함한다.
    호출부는 실패 이유를 구분하지 않는다 — 어느 쪽이든 재로그인이다.
    """
    if not raw_token:
        return None

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, family_id, user_id, expires_at, rotated_at, revoked_at
                FROM auth_sessions
                WHERE token_hash = %s
                LIMIT 1
                FOR UPDATE
                """,
                (_hash(raw_token),),
            )
            row = cursor.fetchone()
            if not row:
                conn.commit()
                return None

            now = _utcnow()

            if row["revoked_at"] is not None or row["expires_at"] <= now:
                conn.commit()
                return None

            if row["rotated_at"] is not None:
                # 이미 회전한 토큰이 다시 왔다.
                if (now - row["rotated_at"]).total_seconds() <= ROTATION_GRACE_SECONDS:
                    # 유예 안이면 응답 유실이나 동시 요청으로 본다.
                    #
                    # 여기서 새 토큰만 하나 더 발급하면 사슬이 갈라진다. 갈라진
                    # 두 사슬은 각자 자기 토큰만 쓰므로 "회전된 토큰을 다시
                    # 제시" 하는 일이 다시는 없고, 그러면 재사용 감지가 영영
                    # 발동하지 않는다. 같은 토큰을 반복해 보내 토큰을 무한히
                    # 찍어낼 수도 있다.
                    #
                    # 그래서 살아 있는 것을 전부 끊고 하나만 새로 낸다. 사슬이
                    # 항상 하나로 유지되고, 방금 끊긴 이 토큰을 또 보내면 위의
                    # revoked_at 검사에 걸려 아무것도 발급되지 않는다.
                    cursor.execute(
                        """
                        UPDATE auth_sessions
                        SET revoked_at = %s
                        WHERE family_id = %s AND revoked_at IS NULL
                        """,
                        (now, row["family_id"]),
                    )
                    raw_new, expires_at = _insert(cursor, row["user_id"], row["family_id"], user_agent)
                    conn.commit()
                    return {
                        "user_id": row["user_id"],
                        "token": raw_new,
                        "expires_at": expires_at,
                    }
                # 유예를 넘겼으면 탈취로 본다. 이 로그인에서 파생된 사슬을 통째로 끊는다.
                cursor.execute(
                    """
                    UPDATE auth_sessions
                    SET revoked_at = %s
                    WHERE family_id = %s AND revoked_at IS NULL
                    """,
                    (now, row["family_id"]),
                )
                conn.commit()
                return None

            # rotated_at 만 찍는다. revoked_at 까지 찍으면 위의 취소 검사에
            # 먼저 걸려서 재사용 감지(유예 포함)가 아예 돌지 않는다.
            cursor.execute(
                "UPDATE auth_sessions SET rotated_at = %s WHERE id = %s",
                (now, row["id"]),
            )
            raw_new, expires_at = _insert(cursor, row["user_id"], row["family_id"], user_agent)
        conn.commit()
        return {"user_id": row["user_id"], "token": raw_new, "expires_at": expires_at}
    finally:
        conn.close()


def revoke_session(raw_token: str) -> None:
    """로그아웃. 같은 family 전체를 끊는다 — 한 기기에서 이어진 사슬이므로."""
    if not raw_token:
        return
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE auth_sessions
                SET revoked_at = %s
                WHERE revoked_at IS NULL
                  AND family_id = (
                      SELECT family_id FROM (
                          SELECT family_id FROM auth_sessions WHERE token_hash = %s LIMIT 1
                      ) AS t
                  )
                """,
                (_utcnow(), _hash(raw_token)),
            )
        conn.commit()
    finally:
        conn.close()


def revoke_all_for_user(user_id: str) -> None:
    """해당 사용자의 모든 기기에서 로그아웃."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE auth_sessions SET revoked_at = %s WHERE user_id = %s AND revoked_at IS NULL",
                (_utcnow(), user_id),
            )
        conn.commit()
    finally:
        conn.close()


def purge_expired() -> int:
    """만료되거나 끊긴 지 오래된 행을 지운다. 표가 무한히 자라지 않게 한다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            # 이미 회전한 행은 재사용 감지에만 쓰인다. 오래 두면 그 창이 길어지는
            # 이점보다 표가 커지는 부담이 크다. 7일이면 충분하다.
            cutoff = _utcnow() - timedelta(days=7)
            cursor.execute(
                """
                DELETE FROM auth_sessions
                WHERE expires_at < %s
                   OR (revoked_at IS NOT NULL AND revoked_at < %s)
                   OR (rotated_at IS NOT NULL AND rotated_at < %s)
                """,
                (cutoff, cutoff, cutoff),
            )
            deleted = cursor.rowcount
        conn.commit()
        return deleted
    finally:
        conn.close()


def load_token_user(user_id: str) -> dict[str, Any] | None:
    """액세스 토큰에 담을 사용자 정보를 DB 에서 다시 읽는다.

    회전 때마다 DB 를 보므로, 탈퇴하거나 이름을 바꾼 것이 다음 갱신에 반영된다.
    로그인 시점 정보를 토큰끼리 물려주면 그런 변경이 30일 동안 남는다.
    """
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id, u.display_name, ai.provider_user_id
                FROM users u
                LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'kakao'
                WHERE u.id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            row = cursor.fetchone()
    finally:
        conn.close()

    if not row:
        return None
    return {
        "sub": str(row.get("provider_user_id") or row["id"]),
        "nickname": row.get("display_name") or "",
        "user_id": row["id"],
    }

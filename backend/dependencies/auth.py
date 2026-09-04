import os
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt


JWT_ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="Missing JWT_SECRET_KEY")
    return secret


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="토큰 사용자 정보가 올바르지 않습니다")

    return payload


# 관리자로 인정할 role 값. users.role 은 기본 'customer' 다.
ADMIN_ROLES = {"admin"}


def get_current_admin(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """관리자만 통과시킨다.

    권한은 토큰이 아니라 DB 에서 읽는다. 토큰에 담으면 권한을 회수해도
    만료될 때까지(기본 24시간) 관리자로 남고, 새로 부여해도 재로그인
    전까지 반영되지 않는다. 관리자 API 는 호출 빈도가 낮아 조회 1회가
    문제되지 않는다.
    """
    # 순환 import 를 피하려고 함수 안에서 가져온다.
    from services.mysql_user_service import _connect

    user_id = str(current_user.get("user_id") or "").strip()

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, display_name, role FROM users WHERE id = %s LIMIT 1", (user_id,))
            row = cursor.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다")

    if str(row.get("role") or "") not in ADMIN_ROLES:
        # 권한 없음을 403 으로 명확히 구분한다(401 은 인증 자체가 안 된 경우).
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")

    return {**current_user, "role": row["role"], "display_name": row.get("display_name")}

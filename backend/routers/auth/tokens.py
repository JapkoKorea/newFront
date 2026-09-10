"""액세스 토큰 발급과 리프레시 쿠키 처리.

kakao.py(로그인)와 session.py(갱신/로그아웃)가 같은 규칙을 써야 해서 여기에 모았다.

쿠키 설계
---------
리프레시 토큰은 httpOnly 쿠키로만 오간다. JS 가 읽을 수 없으므로 XSS 로
스크립트가 주입돼도 토큰 자체를 퍼갈 수는 없다.

SameSite=Lax 는 등록 도메인(eTLD+1) 기준으로 판정한다. 운영의
japkokorea.com <-> api.japkokorea.com 도, 개발의 localhost:3000 <-> localhost:5000
도(포트는 판정에 안 들어간다) 같은 사이트라 쿠키가 실린다. 반대로 외부
사이트에서 건 요청에는 실리지 않으므로 CSRF 의 기본 방어가 된다.

Path 를 /api/auth 로 좁혀 갱신·로그아웃 요청에만 실리게 한다. 예약이나 결제
API 에는 애초에 붙지 않는다.
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from jose import jwt


JWT_ALGORITHM = "HS256"

REFRESH_COOKIE_NAME = "japko_refresh"
REFRESH_COOKIE_PATH = "/api/auth"

# 액세스 토큰 수명. 짧을수록 탈취 피해가 짧지만 갱신이 잦아진다.
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))

# 리프레시가 없는 경로(모바일 앱)용 장기 토큰. 기존 동작을 그대로 둔다.
LONG_LIVED_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "24"))


def jwt_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", "").strip()


def issue_access_token(user: dict, long_lived: bool = False) -> tuple[str, dict, int]:
    """(토큰, 토큰에 담긴 payload, 남은 초) 를 돌려준다."""
    secret = jwt_secret()
    if not secret:
        raise ValueError("Missing JWT_SECRET_KEY")

    now = datetime.now(timezone.utc)
    lifetime = (
        timedelta(hours=LONG_LIVED_HOURS) if long_lived else timedelta(minutes=ACCESS_TOKEN_MINUTES)
    )
    payload = {
        **user,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
    }
    token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
    return token, payload, int(lifetime.total_seconds())


def _cookie_secure() -> bool:
    """Secure 를 붙일지.

    기본값은 켜짐이다. 설정을 빠뜨리거나 오타가 나면 쿠키가 아예 동작하지
    않아 개발 중에 바로 드러난다. 반대로 기본값이 꺼짐이면 운영에서 리프레시
    토큰이 평문으로 오가는 것을 아무도 모른 채 지나갈 수 있다 — 조용히
    안전하지 않은 쪽으로 떨어지는 편이 훨씬 나쁘다.

    개발에서만 끈다. 프런트 주소가 http:// 로 명시돼 있으면 로컬로 보고
    자동으로 끄고, 그 밖에는 REFRESH_COOKIE_SECURE 로 직접 지정한다.
    """
    explicit = os.getenv("REFRESH_COOKIE_SECURE", "").strip().lower()
    if explicit in {"1", "true", "yes"}:
        return True
    if explicit in {"0", "false", "no"}:
        return False

    front = os.getenv("FRONTEND_BASE_URL", "").strip() or (allowed_origins() or [""])[0]
    return not front.startswith("http://")


def _cookie_domain() -> str | None:
    """쿠키를 받을 호스트 범위. 비워 두는 것이 기본이자 권장이다.

    비워 두면 쿠키를 심은 호스트(api.japkokorea.com)만 받는다. 프런트가
    다른 서브도메인에 있어도 상관없다 - CORS 를 credentials 허용으로 열어
    두었으므로 브라우저가 알아서 실어 보낸다.

    .japkokorea.com 처럼 지정하면 모든 서브도메인이 이 쿠키를 받게 된다.
    스테이징이나 외부 호스팅 서브도메인 하나만 뚫려도(또는 DNS 가 남아
    인수돼도) 리프레시 토큰이 넘어가고, 반대로 그쪽에서 부모 도메인의 쿠키를
    덮어쓸 수도 있다. 서브도메인은 SameSite 기준으로 같은 사이트라 Lax 가
    막아 주지도 않는다. 꼭 필요한 경우가 아니면 지정하지 말 것.
    """
    domain = os.getenv("REFRESH_COOKIE_DOMAIN", "").strip()
    return domain or None


def set_refresh_cookie(response: Response, raw_token: str, expires_at: datetime) -> None:
    # auth_sessions.expires_at 은 tz 없는 UTC 다. 같은 기준으로 뺀다.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    max_age = max(0, int((expires_at - now).total_seconds()))
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
        domain=_cookie_domain(),
        secure=_cookie_secure(),
        httponly=True,
        samesite="lax",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        domain=_cookie_domain(),
        secure=_cookie_secure(),
        httponly=True,
        samesite="lax",
    )


def read_refresh_cookie(request: Request) -> str:
    return (request.cookies.get(REFRESH_COOKIE_NAME) or "").strip()


def allowed_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def origin_is_allowed(request: Request) -> bool:
    """쿠키로 인증하는 요청은 Origin 을 직접 확인한다.

    CORS 는 응답을 읽는 것만 막을 뿐 요청이 서버에 닿는 것 자체는 막지 못한다.
    SameSite=Lax 가 이미 대부분을 거르지만, 갱신은 세션을 회전시키는(=기존
    토큰을 무효로 만드는) 동작이라 한 겹 더 둔다.

    Origin 헤더가 아예 없는 요청은 통과시킨다. 브라우저가 아닌 호출(서버 간,
    테스트)에는 붙지 않는데, 그런 요청은 애초에 남의 쿠키를 들고 올 수 없다.
    """
    origin = (request.headers.get("origin") or "").strip()
    if not origin:
        return True
    return origin in allowed_origins()

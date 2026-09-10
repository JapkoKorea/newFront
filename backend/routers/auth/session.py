"""세션 갱신과 로그아웃.

액세스 토큰은 30분이면 끝난다. 브라우저는 이 두 엔드포인트로 세션을 이어간다.

  POST /api/auth/refresh   리프레시 쿠키 -> 새 액세스 토큰 + 회전된 쿠키
  POST /api/auth/logout    쿠키의 세션을 끊고 쿠키를 지운다

두 엔드포인트만 쿠키를 본다. 나머지 API 는 전부 Authorization 헤더를 쓴다.

실패를 HTTPException 으로 던지지 않고 JSONResponse 로 직접 만든다. 예외로
빠지면 FastAPI 가 응답을 새로 만들기 때문에 여기서 지운 쿠키가 나가지 않는다.
못 쓰는 쿠키를 남겨 두면 방문할 때마다 401 이 한 번씩 더 난다.
"""

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from routers.auth.tokens import (
    clear_refresh_cookie,
    issue_access_token,
    origin_is_allowed,
    read_refresh_cookie,
    set_refresh_cookie,
)
from services.auth_session_service import (
    load_token_user,
    revoke_session,
    rotate_session,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _signed_out(detail: str, reason: str) -> JSONResponse:
    response = JSONResponse(
        status_code=401,
        content={"detail": detail},
        headers={"X-Auth-Error": reason},
    )
    clear_refresh_cookie(response)
    return response


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    if not origin_is_allowed(request):
        return JSONResponse(status_code=403, content={"detail": "허용되지 않은 요청 출처입니다"})

    raw_token = read_refresh_cookie(request)
    if not raw_token:
        # 로그인한 적 없는 방문자도 첫 진입에 한 번 부른다. 흔한 경우다.
        return _signed_out("로그인이 필요합니다", "no_session")

    rotated = rotate_session(raw_token, request.headers.get("user-agent"))
    if not rotated:
        return _signed_out("로그인이 만료되었습니다. 다시 로그인해 주세요.", "expired")

    user = load_token_user(rotated["user_id"])
    if not user:
        # 세션은 살아 있는데 사용자가 없다(탈퇴 등). 세션도 끊는다.
        revoke_session(rotated["token"])
        return _signed_out("사용자를 찾을 수 없습니다", "invalid")

    set_refresh_cookie(response, rotated["token"], rotated["expires_at"])
    token, _payload, expires_in = issue_access_token(user)
    # 화면에 필요한 것만 돌려준다. 이 값은 프런트의 localStorage 에 표시용으로
    # 남으므로, 토큰 claims 를 통째로 주면 카카오 ID 와 이메일까지 거기 쌓인다.
    return {
        "token": token,
        "user": {"nickname": user.get("nickname") or ""},
        "expires_in": expires_in,
    }


@router.post("/logout")
async def logout(request: Request):
    # 갱신과 같은 검사를 건다. 로그아웃도 남의 세션을 끊는 동작이라
    # 외부 사이트가 마음대로 걸 수 있으면 안 된다.
    if not origin_is_allowed(request):
        return JSONResponse(status_code=403, content={"detail": "허용되지 않은 요청 출처입니다"})

    # 실패시켜도 사용자가 할 수 있는 일이 없다. 쿠키는 어떤 경우에도 지운다.
    raw_token = read_refresh_cookie(request)
    if raw_token:
        try:
            revoke_session(raw_token)
        except Exception as error:  # noqa: BLE001 - 로그아웃은 실패해도 진행한다
            print(f"[WARN] logout revoke failed: {error}")

    response = JSONResponse(content={"ok": True})
    clear_refresh_cookie(response)
    return response

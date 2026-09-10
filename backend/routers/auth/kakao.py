"""
app/routers/auth/kakao.py
카카오 OAuth 인증 처리를 위한 FastAPI Router
"""
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
import httpx
import os
from urllib.parse import urlencode, quote, urlsplit
from html import escape as html_escape
import json
import base64
from dotenv import load_dotenv
from routers.auth.tokens import issue_access_token, jwt_secret, set_refresh_cookie
from services.auth_session_service import create_session
from services.mysql_user_service import upsert_oauth_user

load_dotenv()

KAKAO_CLIENT_ID = os.getenv('KAKAO_CLIENT_ID') or os.getenv('VITE_KAKAO_CLIENT_ID')
# KAKAO_CLIENT_SECRET = os.getenv('KAKAO_CLIENT_SECRET')
KAKAO_REDIRECT_URI = os.getenv('KAKAO_REDIRECT_URI')
MOBILE_APP_REDIRECT_URI = os.getenv('MOBILE_APP_REDIRECT_URI', 'japkotaxi://auth/callback').strip()
# 모바일 OAuth는 카카오가 "백엔드 모바일 콜백"으로 돌아오게 해야 한다(웹 페이지 아님).
# 카카오 콘솔 Redirect URI 허용목록에도 동일 값을 등록해야 함.
MOBILE_KAKAO_REDIRECT_URI = os.getenv(
    'MOBILE_KAKAO_REDIRECT_URI',
    'http://localhost:5000/api/auth/kakao/mobile/callback',
).strip()

router = APIRouter(prefix="/api/auth/kakao", tags=["auth"])

class KakaoCode(BaseModel):
    code: str
    redirect_uri: str | None = None

async def _handle_kakao_callback(
    code: str,
    redirect_uri: str | None = None,
    long_lived: bool = False,
):
    """카카오 인가 코드를 우리 액세스 토큰으로 바꾼다.

    long_lived 는 리프레시 토큰을 쓸 수 없는 모바일 앱용이다. 웹은 30분짜리
    액세스 토큰과 리프레시 쿠키(호출부에서 심는다)를 함께 받는다.
    """
    if not KAKAO_CLIENT_ID or not KAKAO_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Kakao OAuth environment is not configured")
    if not jwt_secret():
        raise HTTPException(status_code=500, detail="Missing JWT_SECRET_KEY")

    if not code or not code.strip():
        raise HTTPException(status_code=422, detail="카카오 인증 코드(code)가 필요합니다")

    kakao_client_id = KAKAO_CLIENT_ID
    kakao_redirect_uri = (redirect_uri or KAKAO_REDIRECT_URI).strip()

    token_url = "https://kauth.kakao.com/oauth/token"
    payload = {
        'grant_type': 'authorization_code',
        'client_id': kakao_client_id,
        # 'client_secret': KAKAO_CLIENT_SECRET,
        'redirect_uri': kakao_redirect_uri,
        'code': code.strip()
    }
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(token_url, data=payload)
        if token_resp.status_code != 200:
            error_detail = "카카오 토큰 요청 실패"
            try:
                token_error = token_resp.json()
                kakao_error = token_error.get("error")
                kakao_error_desc = token_error.get("error_description")
                if kakao_error or kakao_error_desc:
                    error_detail = f"카카오 토큰 요청 실패: {kakao_error or ''} {kakao_error_desc or ''}".strip()
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=error_detail)
        token_json = token_resp.json()
        access_token = token_json.get('access_token')
        if not access_token:
            raise HTTPException(status_code=400, detail="access_token 없음")

        user_info_url = "https://kapi.kakao.com/v2/user/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_resp = await client.get(user_info_url, headers=headers)
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="카카오 사용자 정보 조회 실패")
        user_json = user_resp.json()
        kakao_id = user_json.get('id')
        kakao_account = user_json.get('kakao_account', {})
        email = kakao_account.get('email')
        profile = kakao_account.get('profile', {})
        nickname = profile.get('nickname')
        user_id = upsert_oauth_user(
            provider='kakao',
            provider_user_id=str(kakao_id),
            display_name=nickname or 'Unknown',
            # 예약 알림 메일을 보내려면 주소가 있어야 한다. 카카오 동의 항목이라
            # 사용자가 동의하지 않았으면 None 이 온다 - 그 경우 알림은 건너뛴다.
            email=email,
        )

        token, payload, expires_in = issue_access_token(
            {
                'sub': str(kakao_id),
                'email': email,
                'nickname': nickname,
                'user_id': user_id,
            },
            long_lived=long_lived,
        )

        return {
            "token": token,
            "user": payload,
            "expires_in": expires_in,
            "user_id": user_id,
        }


def _encode_state(app_redirect: str) -> str:
    payload = json.dumps({"app_redirect": app_redirect}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


def _allowed_app_redirects() -> set[str]:
    """앱으로 돌려보낼 수 있는 주소 목록.

    기본값은 설정된 앱 스킴 하나뿐이다. 여러 빌드(개발/스토어)를 함께 쓰면
    MOBILE_APP_REDIRECT_ALLOWLIST 에 쉼표로 나열한다.
    """
    raw = os.getenv("MOBILE_APP_REDIRECT_ALLOWLIST", "").strip()
    values = {v.strip() for v in raw.split(",") if v.strip()}
    values.add(MOBILE_APP_REDIRECT_URI)
    return values


def _safe_app_redirect(candidate: str) -> str:
    """허용 목록에 있는 주소만 통과시킨다.

    state 는 공격자가 만들어 붙일 수 있는 값이다. 검증 없이 쓰면
    (1) 이 응답의 HTML/스크립트 안으로 임의 문자열이 들어가고
    (2) 로그인 토큰을 공격자 주소로 실어 보내게 된다.
    스킴과 호스트가 같아야 통과시키고, 아니면 기본 주소로 되돌린다.
    """
    if not candidate:
        return MOBILE_APP_REDIRECT_URI

    allowed = _allowed_app_redirects()
    if candidate in allowed:
        return candidate

    parts = urlsplit(candidate)
    for entry in allowed:
        target = urlsplit(entry)
        if parts.scheme == target.scheme and parts.netloc == target.netloc:
            return candidate
    return MOBILE_APP_REDIRECT_URI


def _decode_state(state: str | None) -> str:
    if not state:
        return MOBILE_APP_REDIRECT_URI
    try:
        decoded = base64.urlsafe_b64decode(state.encode("utf-8") + b"==").decode("utf-8")
        data = json.loads(decoded)
        app_redirect = (data.get("app_redirect") or "").strip()
    except Exception:
        return MOBILE_APP_REDIRECT_URI
    return _safe_app_redirect(app_redirect)


def _app_bridge(url: str) -> HTMLResponse:
    """Chrome은 서버 302 -> 커스텀 스킴(japkotaxi://)을 차단할 수 있다.
    JS 자동 이동 + 수동 '앱으로 돌아가기' 버튼이 있는 HTML로 앱 복귀를 보장한다.

    url 은 _safe_app_redirect 를 거친 값이지만, 뒤에 붙는 오류 메시지는
    카카오가 준 문자열이라 여기서도 이스케이프한다. json.dumps 는 "</script>"
    를 그대로 두기 때문에 스크립트 블록을 닫고 나올 수 있다 - 그걸 막는다.
    """
    url_json = json.dumps(url).replace("<", "\\u003c").replace("/", "\\/")
    html = """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>로그인 완료</title></head>
<body style="font-family:-apple-system,Segoe UI,sans-serif;text-align:center;padding:48px 20px;color:#0f172a;background:#f8fafc;">
<p style="font-size:16px;color:#64748b;">로그인 처리 중입니다...</p>
<p style="margin-top:24px;">
<a id="back" href="__URL__" style="display:inline-block;padding:14px 24px;background:#FEE500;border-radius:12px;text-decoration:none;color:#191919;font-weight:700;">앱으로 돌아가기</a>
</p>
<script>
  var u = __URLJSON__;
  setTimeout(function () { try { window.location.replace(u); } catch (e) {} }, 50);
</script>
</body></html>"""
    html = html.replace("__URLJSON__", url_json).replace(
        "__URL__", html_escape(url, quote=True)
    )
    # 이 페이지는 자기 스크립트 하나만 돌면 된다. 혹시 주입이 남아 있어도
    # 외부로 무엇을 보내지 못하게 막는다.
    return HTMLResponse(
        content=html,
        headers={
            "Content-Security-Policy": (
                "default-src 'none'; style-src 'unsafe-inline'; "
                "script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
            ),
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )


def _start_web_session(request: Request, response: Response, result: dict) -> dict:
    """로그인 결과에 리프레시 쿠키를 붙인다.

    쿠키를 심지 못해도 로그인 자체는 성립시킨다. 30분짜리 액세스 토큰으로는
    쓸 수 있고, 만료되면 다시 로그인하면 된다 — 예전과 같은 상태로 떨어질 뿐
    로그인을 통째로 실패시키는 것보다 낫다.
    """
    user_id = result.pop("user_id", "")
    if user_id:
        try:
            raw_token, expires_at = create_session(user_id, request.headers.get("user-agent"))
            set_refresh_cookie(response, raw_token, expires_at)
        except Exception as error:  # noqa: BLE001
            print(f"[WARN] refresh session not issued: {error}")
    return result


@router.post("/callback")
async def kakao_callback_post(data: KakaoCode, request: Request, response: Response):
    result = await _handle_kakao_callback(data.code, data.redirect_uri)
    return _start_web_session(request, response, result)


@router.get("/callback")
async def kakao_callback_get(
    request: Request,
    response: Response,
    code: str = Query(...),
    redirect_uri: str | None = Query(None),
):
    result = await _handle_kakao_callback(code, redirect_uri)
    return _start_web_session(request, response, result)


@router.get("/authorize-url")
async def kakao_authorize_url(redirect_uri: str | None = Query(None)):
    if not KAKAO_CLIENT_ID or not KAKAO_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Kakao OAuth environment is not configured")

    resolved_redirect_uri = (redirect_uri or KAKAO_REDIRECT_URI).strip()

    query = urlencode(
        {
            "client_id": KAKAO_CLIENT_ID,
            "redirect_uri": resolved_redirect_uri,
            "response_type": "code",
        }
    )
    return {"auth_url": f"https://kauth.kakao.com/oauth/authorize?{query}"}


@router.get("/mobile/start")
async def kakao_mobile_start(app_redirect: str | None = Query(None)):
    if not KAKAO_CLIENT_ID or not KAKAO_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Kakao OAuth environment is not configured")

    # 허용 목록 밖의 주소는 여기서 걸러 낸다. state 에 실리기 전에 막아야
    # 콜백 쪽 검증이 유일한 방어선이 되지 않는다.
    resolved_app_redirect = _safe_app_redirect((app_redirect or "").strip())
    state = _encode_state(resolved_app_redirect)
    query = urlencode(
        {
            "client_id": KAKAO_CLIENT_ID,
            "redirect_uri": MOBILE_KAKAO_REDIRECT_URI,
            "response_type": "code",
            "state": state,
        }
    )
    return {"auth_url": f"https://kauth.kakao.com/oauth/authorize?{query}"}


@router.get("/mobile/callback")
async def kakao_mobile_callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
):
    app_redirect = _decode_state(state)

    if error:
        params = urlencode(
            {
                "error": error,
                "error_description": error_description or error,
            }
        )
        return _app_bridge(f"{app_redirect}?{params}")

    if not code:
        params = urlencode(
            {
                "error": "missing_code",
                "error_description": "카카오 인증 코드가 없습니다.",
            }
        )
        return _app_bridge(f"{app_redirect}?{params}")

    try:
        # 앱은 쿠키를 쓰지 않는다. 갱신 수단이 없으므로 장기 토큰을 그대로 준다.
        result = await _handle_kakao_callback(
            code=code,
            redirect_uri=MOBILE_KAKAO_REDIRECT_URI,
            long_lived=True,
        )
    except HTTPException as exc:
        params = urlencode(
            {
                "error": "callback_failed",
                "error_description": str(exc.detail),
            }
        )
        return _app_bridge(f"{app_redirect}?{params}")

    token = result.get("token", "")
    user = result.get("user", {})
    user_b64 = base64.urlsafe_b64encode(
        json.dumps(user, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8")

    # 토큰을 URL 로 넘긴다. app_redirect 는 허용 목록을 통과한 앱 커스텀
    # 스킴이라 네트워크로 나가지는 않지만, 기기의 브라우저 기록에는 남는다.
    # 앱 작업을 재개하면 일회용 교환 코드(짧은 TTL, 1회 사용)로 바꿀 것.
    redirect_url = (
        f"{app_redirect}?token={quote(token)}"
        f"&user_b64={quote(user_b64)}"
    )
    return _app_bridge(redirect_url)

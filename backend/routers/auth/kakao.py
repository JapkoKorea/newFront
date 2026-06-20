"""
app/routers/auth/kakao.py
카카오 OAuth 인증 처리를 위한 FastAPI Router
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
import httpx
import os
from urllib.parse import urlencode, quote
import json
import base64
from jose import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
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
    'http://localhost:8000/api/auth/kakao/mobile/callback',
).strip()
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '').strip()
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_HOURS = int(os.getenv('JWT_EXPIRES_HOURS', '24'))

router = APIRouter(prefix="/api/auth/kakao", tags=["auth"])

class KakaoCode(BaseModel):
    code: str
    redirect_uri: str | None = None

async def _handle_kakao_callback(code: str, redirect_uri: str | None = None):
    if not KAKAO_CLIENT_ID or not KAKAO_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Kakao OAuth environment is not configured")
    if not JWT_SECRET_KEY:
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
        )

        now = datetime.now(timezone.utc)
        payload = {
            'sub': str(kakao_id),
            'email': email,
            'nickname': nickname,
            'user_id': user_id,
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(hours=JWT_EXPIRES_HOURS)).timestamp()),
        }
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

        return {"token": token, "user": payload}


def _encode_state(app_redirect: str) -> str:
    payload = json.dumps({"app_redirect": app_redirect}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


def _decode_state(state: str | None) -> str:
    if not state:
        return MOBILE_APP_REDIRECT_URI
    try:
        decoded = base64.urlsafe_b64decode(state.encode("utf-8") + b"==").decode("utf-8")
        data = json.loads(decoded)
        app_redirect = (data.get("app_redirect") or "").strip()
        if app_redirect:
            return app_redirect
    except Exception:
        pass
    return MOBILE_APP_REDIRECT_URI


def _app_bridge(url: str) -> HTMLResponse:
    """Chrome은 서버 302 -> 커스텀 스킴(japkotaxi://)을 차단할 수 있다.
    JS 자동 이동 + 수동 '앱으로 돌아가기' 버튼이 있는 HTML로 앱 복귀를 보장한다."""
    url_json = json.dumps(url)
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
        "__URL__", url.replace('"', "%22")
    )
    return HTMLResponse(content=html)


@router.post("/callback")
async def kakao_callback_post(data: KakaoCode):
    return await _handle_kakao_callback(data.code, data.redirect_uri)


@router.get("/callback")
async def kakao_callback_get(code: str = Query(...), redirect_uri: str | None = Query(None)):
    return await _handle_kakao_callback(code, redirect_uri)


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

    resolved_app_redirect = (app_redirect or MOBILE_APP_REDIRECT_URI).strip()
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
        result = await _handle_kakao_callback(code=code, redirect_uri=MOBILE_KAKAO_REDIRECT_URI)
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

    redirect_url = (
        f"{app_redirect}?token={quote(token)}"
        f"&user_b64={quote(user_b64)}"
    )
    return _app_bridge(redirect_url)

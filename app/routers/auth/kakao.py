"""
app/routers/auth/kakao.py
카카오 OAuth 인증 처리를 위한 FastAPI Router
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
import os
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

KAKAO_CLIENT_ID = os.getenv('KAKAO_CLIENT_ID') or os.getenv('VITE_KAKAO_CLIENT_ID')
# KAKAO_CLIENT_SECRET = os.getenv('KAKAO_CLIENT_SECRET')
KAKAO_REDIRECT_URI = os.getenv('KAKAO_REDIRECT_URI')
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'secret')
JWT_ALGORITHM = 'HS256'

router = APIRouter(prefix="/api/auth/kakao", tags=["auth"])

class KakaoCode(BaseModel):
    code: str

async def _handle_kakao_callback(code: str):
    if not KAKAO_CLIENT_ID or not KAKAO_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Kakao OAuth environment is not configured")

    if not code or not code.strip():
        raise HTTPException(status_code=422, detail="카카오 인증 코드(code)가 필요합니다")

    kakao_client_id = KAKAO_CLIENT_ID
    kakao_redirect_uri = KAKAO_REDIRECT_URI

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
            raise HTTPException(status_code=400, detail="카카오 토큰 요청 실패")
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

        payload = {
            'sub': str(kakao_id),
            'email': email,
            'nickname': nickname
        }
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

        return {"token": token, "user": payload}


@router.post("/callback")
async def kakao_callback_post(data: KakaoCode):
    return await _handle_kakao_callback(data.code)


@router.get("/callback")
async def kakao_callback_get(code: str = Query(...)):
    return await _handle_kakao_callback(code)

"""
카카오 OAuth 인증 처리를 위한 FastAPI 예시 코드
- 의존성: fastapi, httpx, python-jose, python-dotenv 등
- 환경변수: KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI, JWT_SECRET_KEY
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

KAKAO_CLIENT_ID = os.getenv('KAKAO_CLIENT_ID')
KAKAO_CLIENT_SECRET = os.getenv('KAKAO_CLIENT_SECRET')
KAKAO_REDIRECT_URI = os.getenv('KAKAO_REDIRECT_URI')
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'secret')
JWT_ALGORITHM = 'HS256'

app = FastAPI()

# CORS 설정 (프론트엔드 주소로 변경 필요)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class KakaoCode(BaseModel):
    code: str

@app.post("/api/auth/kakao/callback")
async def kakao_callback(data: KakaoCode):
    # 1. 카카오에 access_token 요청
    token_url = "https://kauth.kakao.com/oauth/token"
    payload = {
        'grant_type': 'authorization_code',
        'client_id': KAKAO_CLIENT_ID,
        'client_secret': KAKAO_CLIENT_SECRET,
        'redirect_uri': KAKAO_REDIRECT_URI,
        'code': data.code
    }
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(token_url, data=payload)
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="카카오 토큰 요청 실패")
        token_json = token_resp.json()
        access_token = token_json.get('access_token')
        if not access_token:
            raise HTTPException(status_code=400, detail="access_token 없음")

        # 2. 사용자 정보 조회
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

        # 3. (선택) DB에서 사용자 조회/생성 (여기선 생략)
        # user = get_or_create_user(kakao_id, email, nickname)

        # 4. JWT 발급
        payload = {
            'sub': str(kakao_id),
            'email': email,
            'nickname': nickname
        }
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

        return {"token": token, "user": payload} 
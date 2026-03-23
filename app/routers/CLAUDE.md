# app/routers/ — API 라우터 가이드

FastAPI 라우터 모음. 모든 엔드포인트는 `/api` 접두어.

## 라우터 파일

| 파일 | prefix | 주요 엔드포인트 |
|------|--------|----------------|
| `auth/kakao.py` | `/api/auth` | `POST /api/auth/kakao/callback` |
| `reservations.py` | `/api/reservations` | CRUD |
| `payments.py` | `/api/payments` | 결제 처리, 콜백 |

## 엔드포인트 규칙

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/reservations", tags=["reservations"])

class ReservationCreate(BaseModel):
    course: str
    date: str
    pickup: str
    contact: str

@router.post("/", response_model=ReservationResponse)
async def create_reservation(data: ReservationCreate):
    # 비즈니스 로직은 services/에 위임
    return await reservation_service.create(data)
```

## auth/kakao.py — 카카오 OAuth

흐름:
1. 프론트에서 카카오 인가코드 수신 후 `POST /api/auth/kakao/callback` 호출
2. 백엔드가 카카오 토큰 교환 → 사용자 정보 조회
3. DB에 사용자 upsert → JWT 발급 → 응답

환경변수:
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- `KAKAO_REDIRECT_URI` (프론트와 반드시 동일해야 함)
- `JWT_SECRET`

## reservations.py — 예약 API

예약 데이터 CRUD. `mysql_reservation_service`를 통해 DB 접근.

## payments.py — 결제 API

결제 처리 및 콜백 수신. 결제 성공/실패 후 프론트 리디렉션.

## 오류 처리 패턴

```python
from fastapi import HTTPException

# 클라이언트 오류
raise HTTPException(status_code=400, detail="예약 정보가 올바르지 않습니다")

# 인증 오류
raise HTTPException(status_code=401, detail="로그인이 필요합니다")

# 서버 오류는 자연스럽게 500으로 — 민감한 정보 노출 금지
```

## JWT 인증 의존성

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(token = Depends(security)):
    # JWT 검증 로직
    ...
```

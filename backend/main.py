from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from routers.auth import kakao
from services.mysql_user_service import ensure_user_tables
from routers import reservations
from routers import payments
from routers import seo
from services.mysql_reservation_service import ensure_reservation_tables

app = FastAPI()

cors_origins_raw = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")
allowed_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:5173"]

# CORS 설정 (프론트엔드 주소로 변경 권장)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 카카오 인증 라우터 포함
app.include_router(kakao.router)
app.include_router(reservations.router)
app.include_router(payments.router)
app.include_router(seo.router)


@app.on_event("startup")
async def startup_event():
    ensure_user_tables()
    ensure_reservation_tables()

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True) 

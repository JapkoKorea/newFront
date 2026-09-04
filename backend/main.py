from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
import importlib
import sys
import os
from typing import cast

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.mysql_user_service import ensure_user_tables
from routers import seo
from routers import maps
from routers import courses
from services.mysql_reservation_service import ensure_reservation_tables
from services.mysql_catalog_service import ensure_catalog_tables, seed_catalog
from services.mysql_chat_service import ensure_chat_tables


def _load_kakao_router() -> APIRouter | None:
    try:
        from routers.auth import kakao  # pylint: disable=import-outside-toplevel

        return kakao.router
    except ModuleNotFoundError as error:
        missing = getattr(error, "name", "")
        if missing in {"jose", "jwt"}:
            print(
                f"[WARN] Kakao auth router disabled: missing dependency '{missing}'. Install backend auth deps to enable /api/auth routes."
            )
            return None
        raise


def _load_optional_router(
    module_name: str,
    route_name: str,
    optional_missing: set[str],
) -> APIRouter | None:
    try:
        module = importlib.import_module(module_name)
        return cast(APIRouter, getattr(module, "router"))
    except ModuleNotFoundError as error:
        missing = getattr(error, "name", "")
        if missing in optional_missing:
            print(
                f"[WARN] {route_name} router disabled: missing dependency '{missing}'."
            )
            return None
        raise

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
kakao_router = _load_kakao_router()
if kakao_router is not None:
    app.include_router(kakao_router)

reservations_router = _load_optional_router(
    "routers.reservations",
    route_name="reservations",
    optional_missing={"jose", "jwt"},
)
if reservations_router is not None:
    app.include_router(reservations_router)

payments_router = _load_optional_router(
    "routers.payments",
    route_name="payments",
    optional_missing={"jose", "jwt"},
)
if payments_router is not None:
    app.include_router(payments_router)

admin_router = _load_optional_router(
    "routers.admin",
    route_name="admin",
    optional_missing={"jose", "jwt"},
)
if admin_router is not None:
    app.include_router(admin_router)

chat_router = _load_optional_router(
    "routers.chat",
    route_name="chat",
    optional_missing={"jose", "jwt"},
)
if chat_router is not None:
    app.include_router(chat_router)

app.include_router(seo.router)
app.include_router(maps.router)
app.include_router(courses.router)


@app.on_event("startup")
async def startup_event():
    try:
        ensure_user_tables()
    except Exception as error:
        print(f"[WARN] user table initialization skipped: {error}")

    try:
        ensure_reservation_tables()
    except Exception as error:
        print(f"[WARN] reservation table initialization skipped: {error}")

    try:
        ensure_catalog_tables()
        seed_catalog()
    except Exception as error:
        print(f"[WARN] catalog table initialization skipped: {error}")

    try:
        ensure_chat_tables()
    except Exception as error:
        print(f"[WARN] chat table initialization skipped: {error}")

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True) 

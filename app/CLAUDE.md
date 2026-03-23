# app/ — 백엔드 작업 가이드

FastAPI 기반 백엔드. 카카오 인증, 예약 관리, 결제 API 제공.

## 실행

```bash
# 개발 (자동 리로드)
uvicorn app.main:app --reload --port 8000

# 직접 실행 (port 5000)
python app/main.py
```

## 앱 구조

```
app/
├── main.py          # 앱 팩토리: CORS, 라우터 등록, startup 이벤트
├── routers/         # API 엔드포인트 (→ routers/CLAUDE.md 참조)
│   ├── auth/
│   │   └── kakao.py
│   ├── reservations.py
│   └── payments.py
└── services/        # 비즈니스 로직 + DB 작업
    ├── mysql_user_service.py
    └── mysql_reservation_service.py
```

## 코딩 규칙

- **PEP 8** 스타일 준수
- 모든 함수 시그니처에 **타입 힌트** 필수
- 요청/응답 데이터는 **Pydantic 모델** 정의
- 라우터는 얇게 — 비즈니스 로직은 `services/`에 위임
- I/O 작업 (DB, HTTP)은 **`async/await`** 사용

## main.py 핵심 사항

- CORS: 현재 `allow_origins=["*"]` → **프로덕션 배포 전 반드시 도메인 제한**
- startup 이벤트에서 DB 테이블 자동 생성 (`ensure_*_tables()`)
- 라우터 prefix는 각 라우터 파일에서 정의

## 환경변수 (`.env.local`)

```
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=http://localhost:5173/login
JWT_SECRET=...
MYSQL_HOST=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DB=...
```

python-dotenv로 로드. 절대 하드코딩 금지.

## services/ 패턴

```python
# mysql_reservation_service.py 예시 패턴
import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        ...
    )

def ensure_reservation_tables():
    # CREATE TABLE IF NOT EXISTS ...

async def create_reservation(data: ReservationCreate) -> dict:
    # INSERT 로직
```

## 의존성 관리

`pyproject.toml` + `uv` 사용:
```bash
uv add <package>      # 패키지 추가
uv sync               # 의존성 동기화
```

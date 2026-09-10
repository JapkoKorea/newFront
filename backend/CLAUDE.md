# backend/ — 백엔드 작업 가이드

FastAPI 기반 백엔드. 카카오 인증, 예약 관리, 결제 API 제공.

## 실행

```bash
# 개발 (자동 리로드)
uvicorn backend.main:app --reload --port 5000

# 직접 실행 (port 5000)
python backend/main.py
```

## 앱 구조

```
backend/
├── main.py          # 앱 팩토리: CORS, 라우터 등록, startup 이벤트
├── routers/         # API 엔드포인트 (→ routers/CLAUDE.md 참조)
│   ├── auth/
│   │   ├── kakao.py     # 로그인 (인가 코드 -> 액세스 토큰 + 리프레시 쿠키)
│   │   ├── session.py   # POST /api/auth/refresh, /api/auth/logout
│   │   └── tokens.py    # 토큰 발급 + 쿠키 규칙 (양쪽이 공유)
│   ├── reservations.py
│   └── payments.py
└── services/        # 비즈니스 로직 + DB 작업
    ├── mysql_user_service.py
    ├── auth_session_service.py   # 리프레시 토큰 저장소 (회전·재사용 감지)
    ├── notification_service.py   # 예약 알림 메일 (SMTP)
    └── mysql_reservation_service.py
```

## 코딩 규칙

- **PEP 8** 스타일 준수
- 모든 함수 시그니처에 **타입 힌트** 필수
- 요청/응답 데이터는 **Pydantic 모델** 정의
- 라우터는 얇게 — 비즈니스 로직은 `services/`에 위임
- I/O 작업 (DB, HTTP)은 **`async/await`** 사용

## main.py 핵심 사항

- CORS: `CORS_ALLOW_ORIGINS` 로 제한. 전체 허용(`*`) 금지
- 쿠키 인증이 있으므로 `allow_credentials=True` 유지 필수
- startup 이벤트에서 DB 테이블 자동 생성 (`ensure_*_tables()`)
- 라우터 prefix는 각 라우터 파일에서 정의

## 환경변수 (`.env.local`)

```
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=http://localhost:3000/login
JWT_SECRET_KEY=
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=30
REFRESH_COOKIE_DOMAIN=      # 운영만: .japkokorea.com...
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

## 알림 (notification_service.py)

예약 흐름의 네 지점에서 메일이 나간다.

| 시점 | 받는 사람 |
|------|-----------|
| 예약 접수 | 운영자 + 고객 |
| 확정 / 반려 / 취소 / 완료 | 고객 |
| 고객 취소 요청 | 운영자 |
| 결제 확인 요청 | 운영자 |

두 가지를 반드시 지킬 것.

- **알림 실패가 본 작업을 막으면 안 된다.** 모든 전송은 예외를 삼키고 로그만
  남긴다. 메일 서버가 죽었다고 고객 예약이 실패하면 훨씬 나쁘다.
- **`BackgroundTasks` 로 응답 뒤에 보낸다.** SMTP 는 블로킹이라 응답 안에서
  보내면 예약 화면이 같이 느려진다.

`SMTP_*` 가 없으면 조용히 건너뛴다(`is_configured()`). 고객 주소는
`users.email` 이고, 카카오 이메일 동의를 안 한 사용자는 값이 없다 — 그 경우
고객 알림만 빠지고 운영자 알림은 그대로 나간다.

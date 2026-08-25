# 배포 가이드

웹은 Vercel, API 서버는 Docker 로 배포한다. DB 는 기존 `japko_local` 을 공유한다.

```
[브라우저] --> [Vercel: Next.js 웹] --> [API 서버: FastAPI:8000] --> [MySQL: japko_local]
                                                ^
                                                | 같은 DB
                                        [LINE/카카오 챗 백엔드]
```

---

## 1. 사전 준비 (사람이 해야 하는 것)

| 항목 | 내용 |
|---|---|
| 사업자 정보 | `src/data/company.js` 의 7개 값. 미입력 시 화면에 "확인 중" 으로 표시되며 PG 심사에서 반려된다 |
| 토스페이먼츠 | 상점 등록 후 `TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` 발급. 없으면 결제 요청이 500 |
| 카카오 개발자콘솔 | 웹/모바일 리다이렉트 URI 를 프로덕션 도메인으로 등록 |
| Google Cloud | 지도 키를 브라우저용(리퍼러 제한)과 서버용(IP 제한) 두 개로 분리 |
| 도메인 | 웹 도메인과 API 도메인 (예: `japko.kr`, `api.japko.kr`) |

---

## 2. 웹 배포 (Vercel)

1. vercel.com > Add New Project > `JapkoKorea/newFront` import
2. Framework 는 Next.js 자동 감지, Root Directory 는 리포 루트 그대로 둔다
3. 환경변수 등록:

```
NEXT_PUBLIC_API_BASE_URL=https://api.도메인
NEXT_PUBLIC_SITE_URL=https://웹도메인
NEXT_PUBLIC_GOOGLE_MAPS_KEY=브라우저용_키
NEXT_PUBLIC_KAKAO_CLIENT_ID=카카오_JS_키
NEXT_PUBLIC_KAKAO_REDIRECT_URI=https://웹도메인/login
```

`NEXT_PUBLIC_SITE_URL` 을 지정하지 않으면 Vercel 배포 URL 을 사용한다. 사이트맵과
canonical 에 그대로 들어가므로 커스텀 도메인 연결 후에는 반드시 지정할 것.

4. Deploy. 이후 `main` 브랜치에 푸시하면 자동 재배포된다.

### API 없이도 열리는 페이지

API 서버 배포 전에도 아래는 정상 동작한다. PG 심사에 필요한 페이지는 모두 포함된다.

`/` `/products` `/products/[slug]` `/guide` `/guide/[slug]` `/pricing`
`/terms` `/privacy` `/refund` `/tours/[id]` (정적 데이터 폴백)

로그인, 예약 생성, 결제는 API 서버가 필요하다.

---

## 3. API 서버 배포 (Docker)

```bash
cp .env.example .env      # 값 채우기
docker compose up -d --build
docker compose logs -f api
```

프로덕션에서 반드시 확인할 값:

```
CORS_ALLOW_ORIGINS=https://웹도메인          # Vercel 도메인. 미설정 시 브라우저 호출이 차단된다
FRONTEND_BASE_URL=https://웹도메인           # 결제 성공/실패 리다이렉트. 기본값이 localhost:5173 이라 반드시 지정
SITE_URL=https://웹도메인
MOBILE_KAKAO_REDIRECT_URI=https://api도메인/api/auth/kakao/mobile/callback
JWT_SECRET_KEY=충분히_긴_임의_문자열
GOOGLE_MAPS_SERVER_KEY=서버용_키
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
```

컨테이너는 8000 포트로 뜬다. 앞단에 nginx 등 리버스 프록시를 두고 TLS 를 종료시킨다.

### DB 연결

`MYSQL_HOST` 는 상황에 따라 다르다.

- 호스트에 설치된 MySQL: `host.docker.internal` (compose 기본값)
- 관리형 DB: 해당 엔드포인트를 `.env` 에 지정

테이블은 앱 기동 시 `CREATE TABLE IF NOT EXISTS` 로 자동 생성되며, 코스 시드도
비파괴적으로 입력된다. 기존 데이터는 건드리지 않는다.

---

## 4. 배포 후 점검

```bash
curl https://api도메인/api/courses                  # 200 + 코스 목록
curl https://웹도메인/sitemap.xml                    # 웹 도메인 기준 URL 이 나오는지
curl -I https://웹도메인/terms                       # 200
```

- 브라우저에서 홈 > 상품 > 예약 진입까지 확인
- 카카오 로그인 후 예약 생성 확인
- 결제는 토스 테스트 키로 승인/취소 각각 확인

---

## 5. 로컬 개발

```bash
nvm use 22.19.0                                     # arm64 Mac 에서 x64 node 를 쓰면 sharp 오류
pnpm dev                                            # 웹 3000
cd backend && uvicorn main:app --reload --port 5000  # API 5000
```

로컬 `.env` 는 프론트 3000 / API 5000 조합으로 맞춰져 있다.

---

## 6. 알려진 제약

- 송영(transfer) 예약은 관리자 견적 기능이 없어 견적 확정 전까지 결제가 진행되지 않는다.
  결제 시도 시 "견적 안내를 기다려 주세요" 안내가 표시된다.
- 관리자용 화면이 없다. 예약 상태 변경은 DB 또는 챗 백엔드를 통해 처리한다.
- 자동화된 테스트가 없다. 배포 후 위 점검 항목을 수동으로 확인할 것.

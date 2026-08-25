# 배포 가이드

웹과 API 를 서버 한 대에 Docker 로 올리고, Caddy 가 앞단에서 TLS 를 처리한다.
DB 는 기존 `japko_local` 을 공유한다.

```
                    :443
[브라우저] --> [Caddy] --+--> [web:3000  Next.js]
                         |
                         +--> [api:8000  FastAPI] --> [MySQL: japko_local]
                                                            ^
                                                            | 같은 DB
                                                    [LINE/카카오 챗 백엔드]
```

Caddy 는 Let's Encrypt 인증서를 자동 발급하고 갱신한다. certbot 설정이 필요 없다.
Vercel 로 웹을 분리하고 싶으면 5장을 참고한다.

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

## 2. 서버 준비 (EC2 / Lightsail / 임의의 VPS)

권장 사양은 메모리 2GB 이상이다. 컨테이너 안에서 `next build` 가 돌기 때문에
1GB 인스턴스에서는 빌드 중 OOM 이 날 수 있다.

```bash
# Docker 설치 (Amazon Linux 2023 기준)
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # 재로그인 필요

# Docker Compose 플러그인
sudo dnf install -y docker-compose-plugin
```

보안 그룹(방화벽)에서 80, 443 을 열어둔다. 8000, 3000 은 열지 않는다 —
Caddy 만 외부에 노출되고 나머지는 내부 네트워크에서만 통신한다.

DNS 에서 웹 도메인과 API 도메인을 서버 IP 로 지정한다. Caddy 가 인증서를
발급하려면 DNS 가 먼저 전파되어 있어야 한다.

```
japko.kr        A   <서버 IP>
api.japko.kr    A   <서버 IP>
```

---

## 3. 배포

```bash
git clone https://github.com/JapkoKorea/newFront.git
cd newFront
cp .env.example .env      # 값 채우기
docker compose up -d --build
docker compose logs -f
```

`.env` 에서 반드시 확인할 값:

```
WEB_DOMAIN=japko.kr                          # Caddy 가 이 도메인으로 인증서 발급
API_DOMAIN=api.japko.kr

NEXT_PUBLIC_API_BASE_URL=https://api.japko.kr
NEXT_PUBLIC_SITE_URL=https://japko.kr
NEXT_PUBLIC_GOOGLE_MAPS_KEY=브라우저용_키
NEXT_PUBLIC_KAKAO_CLIENT_ID=카카오_JS_키
NEXT_PUBLIC_KAKAO_REDIRECT_URI=https://japko.kr/login

CORS_ALLOW_ORIGINS=https://japko.kr          # 미설정 시 브라우저 호출이 차단된다
FRONTEND_BASE_URL=https://japko.kr           # 결제 성공/실패 리다이렉트
SITE_URL=https://japko.kr
MOBILE_KAKAO_REDIRECT_URI=https://api.japko.kr/api/auth/kakao/mobile/callback
JWT_SECRET_KEY=충분히_긴_임의_문자열
GOOGLE_MAPS_SERVER_KEY=서버용_키
TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
```

**주의: `NEXT_PUBLIC_*` 는 빌드 시점에 번들에 박힌다.** 값을 바꾸면 컨테이너
재시작이 아니라 재빌드가 필요하다.

```bash
docker compose up -d --build web
```

### DB 연결

`MYSQL_HOST` 는 상황에 따라 다르다.

- 같은 서버의 호스트 MySQL: `host.docker.internal` (compose 기본값)
- RDS 등 관리형 DB: 해당 엔드포인트

결제 기록이 쌓이는 DB이므로 백업 가능한 구성을 권장한다.

테이블은 앱 기동 시 `CREATE TABLE IF NOT EXISTS` 로 자동 생성되며, 코스 시드도
비파괴적으로 입력된다. 기존 데이터는 건드리지 않는다.

### 인증서

Caddy 가 발급한 인증서는 `caddy_data` 볼륨에 저장된다. **이 볼륨을 지우면
재발급이 일어나므로 Let's Encrypt 발급 한도에 걸릴 수 있다.** 컨테이너를 지울 때
`docker compose down` 만 쓰고 `-v` 는 붙이지 않는다.

---

## 4. 배포 후 점검

```bash
curl https://api.japko.kr/api/courses               # 200 + 코스 목록
curl https://japko.kr/sitemap.xml                   # 웹 도메인 기준 URL 이 나오는지
curl -I https://japko.kr/terms                      # 200, 인증서 유효
docker compose ps                                   # 세 컨테이너 모두 running
```

- 브라우저에서 홈 > 상품 > 예약 진입까지 확인
- 카카오 로그인 후 예약 생성 확인
- 결제는 토스 테스트 키로 승인/취소 각각 확인

---

## 5. 웹만 Vercel 로 분리하는 경우

서버 운영 부담을 줄이려면 웹을 Vercel 에 올리고 API 만 이 서버에 둘 수 있다.

- Vercel Hobby(무료) 플랜은 **상업적 사용을 허용하지 않는다.** 결제를 받는
  서비스이므로 Pro 플랜이 필요하다.
- vercel.com > Add New Project > `JapkoKorea/newFront` import, Root Directory 는 리포 루트
- 환경변수는 `NEXT_PUBLIC_*` 다섯 개를 등록한다
- 이 경우 compose 에서 `web` 과 `caddy` 서비스를 빼고 API 만 올린다

### API 없이도 열리는 페이지

API 서버 배포 전에도 아래는 정상 동작한다. PG 심사에 필요한 페이지는 모두 포함된다.

`/` `/products` `/products/[slug]` `/guide` `/guide/[slug]` `/pricing`
`/terms` `/privacy` `/refund` `/tours/[id]` (정적 데이터 폴백)

로그인, 예약 생성, 결제는 API 서버가 필요하다.

---

## 6. 로컬 개발

```bash
nvm use 22.19.0                                     # arm64 Mac 에서 x64 node 를 쓰면 sharp 오류
pnpm dev                                            # 웹 3000
cd backend && uvicorn main:app --reload --port 5000  # API 5000
```

로컬 `.env` 는 프론트 3000 / API 5000 조합으로 맞춰져 있다.

---

## 7. 알려진 제약

- 송영(transfer) 예약은 관리자 견적 기능이 없어 견적 확정 전까지 결제가 진행되지 않는다.
  결제 시도 시 "견적 안내를 기다려 주세요" 안내가 표시된다.
- 관리자용 화면이 없다. 예약 상태 변경은 DB 또는 챗 백엔드를 통해 처리한다.
- 자동화된 테스트가 없다. 배포 후 위 점검 항목을 수동으로 확인할 것.

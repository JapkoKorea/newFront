# 배포 가이드

웹, API, DB 를 **Oracle Cloud 무료 서버 한 대**에 Docker 로 올린다. Caddy 가
앞단에서 TLS 를 처리한다. 서버 비용은 0원이고, 드는 돈은 도메인뿐이다.

```
                         :443
[브라우저] --> [Cloudflare DNS] --> [Caddy] --+--> [web:3000  Next.js]
                                              |
                                              +--> [api:8000  FastAPI] --> [mysql:3306]
                                                                               ^
                                                         (나중에) 챗 백엔드 ----+
```

- Caddy 는 Let's Encrypt 인증서를 자동 발급·갱신한다. certbot 이 필요 없다.
- MySQL 도 compose 안에서 돈다. 데이터는 `mysql_data` 볼륨에 남는다.
- LINE/카카오 챗 백엔드(japko/Backend)는 아직 로컬 전용이다. 나중에 같은
  서버에 올려 같은 DB 를 쓰게 한다(8장).

왜 이 구성인가: 결제를 받는 서비스라 Vercel 무료(Hobby) 플랜은 쓸 수 없다
(상업적 사용 금지). Render 같은 무료 PaaS 는 15분 쉬면 잠들어 첫 손님이 1분을
기다린다. 무료 MySQL 은 따로 구하기 어렵다. Oracle 무료 서버는 상업적 사용이
되고, 24시간 켜져 있고, 지금 compose 구성을 그대로 올릴 수 있다.

---

## 1. 사전 준비 (사람이 해야 하는 것)

| 항목 | 내용 |
|---|---|
| 사업자 정보 | `src/data/company.js` 의 값. 미입력 시 화면에 "확인 중" 으로 표시된다 |
| 카카오 개발자콘솔 | 웹/모바일 리다이렉트 URI 를 프로덕션 도메인으로 등록 |
| Google Cloud | 지도 키를 브라우저용(리퍼러 제한)과 서버용(IP 제한) 두 개로 분리. 브라우저 키에 Maps JavaScript, Places, Routes API 가 켜져 있어야 한다 |
| 도메인 | `japkokorea.com`, `api.japkokorea.com`. DNS 는 Cloudflare(무료)에 둔다 |
| 메일 | 알림 메일용 SMTP (Gmail 앱 비밀번호 등). 없으면 알림만 빠진다 |

---

## 2. Oracle Cloud 서버 만들기

### 2.1 가입

1. cloud.oracle.com 에서 Free Tier 가입. 본인 확인용으로 카드를 등록한다(과금되지 않는다).
2. **홈 리전은 나중에 바꿀 수 없다.** 무료 자원은 홈 리전에서만 쓸 수 있으므로
   South Korea Central (Seoul) 또는 South Korea North (Chuncheon) 을 고른다.
3. 가입 후 **종량제(Pay As You Go)로 업그레이드**하는 것을 권장한다. 무료 한도
   안에서는 여전히 0원이고, 무료 계정에 적용되는 "놀고 있는 인스턴스 회수"
   대상에서 빠진다. 손님이 적은 시기에 CPU 사용률이 낮다고 서버가 회수되면 곤란하다.
   업그레이드 전 Oracle 공식 문서에서 현재 정책을 한 번 확인할 것.

> 2026-06 에 무료 ARM 한도가 4 OCPU / 24GB 에서 **2 OCPU / 12GB** 로 예고 없이
> 줄었다. 이 구성은 그 안에서 충분히 돈다. 조건이 또 바뀔 수 있으니 6장의
> **서버 밖 백업**은 반드시 켜 둔다.

### 2.2 인스턴스 생성

Compute > Instances > Create instance

| 항목 | 값 |
|---|---|
| Image | Canonical Ubuntu 24.04 (aarch64) |
| Shape | Ampere `VM.Standard.A1.Flex` — **2 OCPU, 12 GB** |
| Boot volume | 기본값(약 47GB). 무료 한도는 블록 스토리지 합계 200GB |
| SSH key | 내 공개키 업로드 |
| Public IP | 할당 |

"Out of capacity" 가 나오면 서울 리전에 ARM 여유가 없는 것이다. 다른 가용성
도메인(AD)을 고르거나 몇 시간 뒤 다시 시도한다.

공인 IP 는 인스턴스를 삭제하지 않는 한 유지된다. 확실히 고정하려면
Networking 에서 Reserved Public IP 로 바꾼다.

### 2.3 방화벽 — 두 군데를 열어야 한다

**(1) Oracle 쪽 (VCN Security List)**: Networking > Virtual cloud networks >
해당 VCN > Security Lists > Default > Add Ingress Rules

```
Source CIDR 0.0.0.0/0   TCP   Destination port 80
Source CIDR 0.0.0.0/0   TCP   Destination port 443
```

**(2) 서버 안 (iptables)**: Oracle 의 Ubuntu 이미지는 SSH(22) 외 모든 포트를
iptables 로 막아 둔다. Security List 만 열고 여기를 빼먹으면 인증서 발급이
계속 실패한다.

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

3306(MySQL), 3000, 8000 은 **열지 않는다.** Caddy 만 외부에 노출된다.

### 2.4 Docker 설치

```bash
ssh ubuntu@<서버 IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # 다시 접속해야 docker 그룹이 적용된다
```

### 2.5 DNS (Cloudflare)

```
japkokorea.com        A   <서버 IP>   프록시: DNS only (회색 구름)
api.japkokorea.com    A   <서버 IP>   프록시: DNS only (회색 구름)
```

처음에는 **DNS only** 로 둔다. Caddy 가 직접 인증서를 받아야 하기 때문이다.
나중에 Cloudflare 프록시(주황 구름)를 켜려면 SSL/TLS 모드를 **Full (strict)** 로
맞춘다. Flexible 로 두면 무한 리다이렉트가 난다.

---

## 3. 배포

```bash
git clone https://github.com/JapkoKorea/newFront.git
cd newFront
cp .env.example .env      # 값 채우기 (아래)
docker compose up -d --build
docker compose logs -f
```

첫 빌드는 Next.js 빌드 때문에 몇 분 걸린다.

`.env` 에서 반드시 채울 값:

```
WEB_DOMAIN=japkokorea.com                    # Caddy 가 이 도메인으로 인증서 발급
API_DOMAIN=api.japkokorea.com

NEXT_PUBLIC_API_BASE_URL=https://api.japkokorea.com
NEXT_PUBLIC_SITE_URL=https://japkokorea.com
NEXT_PUBLIC_GOOGLE_MAPS_KEY=브라우저용_키
NEXT_PUBLIC_KAKAO_CLIENT_ID=카카오_JS_키
NEXT_PUBLIC_KAKAO_REDIRECT_URI=https://japkokorea.com/login

KAKAO_CLIENT_ID=카카오_REST_키
KAKAO_REDIRECT_URI=https://japkokorea.com/login
MOBILE_KAKAO_REDIRECT_URI=https://api.japkokorea.com/api/auth/kakao/mobile/callback
CORS_ALLOW_ORIGINS=https://japkokorea.com    # 미설정 시 브라우저 호출이 전부 막힌다
FRONTEND_BASE_URL=https://japkokorea.com
SITE_URL=https://japkokorea.com
JWT_SECRET_KEY=충분히_긴_임의_문자열
GOOGLE_MAPS_SERVER_KEY=서버용_키

# DB — compose 안의 mysql 컨테이너. 최초 기동 때 이 값으로 계정이 만들어진다.
MYSQL_USER=japko                             # root 금지 (컨테이너가 뜨지 않는다)
MYSQL_PASSWORD=긴_임의_문자열
MYSQL_ROOT_PASSWORD=다른_긴_임의_문자열
MYSQL_DATABASE=japko_local

BACKUP_RCLONE_REMOTE=r2:japko-backups        # 6장 참고
```

임의 문자열은 `openssl rand -base64 32` 로 만든다.

**주의: `NEXT_PUBLIC_*` 는 빌드 시점에 번들에 박힌다.** 값을 바꾸면 컨테이너
재시작이 아니라 재빌드가 필요하다.

```bash
docker compose up -d --build web
```

### 시간대

백엔드 코드와 SQL 이 시간대 없는 `now()` / `NOW()` 를 쓴다. 개발 환경(맥의
로컬 MySQL)이 한국 시간이라, compose 는 모든 컨테이너를 `TZ=Asia/Seoul` 로
맞춰 둔다. 이 값을 지우면 당일/전일 판정과 기록 시각이 9시간 어긋난다.

### 인증서

Caddy 가 발급한 인증서는 `caddy_data` 볼륨에 저장된다. **이 볼륨을 지우면
재발급이 일어나 Let's Encrypt 발급 한도에 걸릴 수 있다.**

### 볼륨을 지우지 말 것

`docker compose down` 은 괜찮다. **`docker compose down -v` 는 DB 와 인증서를
통째로 지운다.** 절대 `-v` 를 붙이지 않는다.

---

## 4. 로컬 데이터 옮기기 (최초 1회)

테이블은 앱이 처음 뜰 때 `CREATE TABLE IF NOT EXISTS` 로 자동 생성되고 코스
시드도 들어간다. 로컬에 쌓인 예약·회원 데이터까지 옮기려면:

```bash
# 1) 맥에서 덤프
mysqldump -h127.0.0.1 -uroot -p --single-transaction --routines --triggers \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 japko_local \
  | gzip > japko_local.sql.gz

# 2) 서버로 복사
scp japko_local.sql.gz ubuntu@<서버 IP>:~/newFront/

# 3) 서버에서 넣기 (yes 를 입력해야 진행된다)
cd ~/newFront
scripts/restore-db.sh japko_local.sql.gz
docker compose restart api
```

로컬 MySQL 9.4 에서 뜬 덤프가 서버의 MySQL 8.4 에 그대로 들어가는 것을
확인했다(테이블 17개, 행 수 일치).

시험용 데이터만 있다면 이 단계는 건너뛰고 빈 DB 로 시작해도 된다.

---

## 5. 배포 후 점검

```bash
curl https://api.japkokorea.com/api/courses        # 200 + 코스 목록
curl https://japkokorea.com/sitemap.xml            # 웹 도메인 기준 URL 이 나오는지
curl -I https://japkokorea.com/terms               # 200, 인증서 유효
docker compose ps                                  # 네 컨테이너 모두 running / healthy
```

- 브라우저에서 홈 > 상품 > 예약 진입, 지도와 경로선이 뜨는지 확인
- 카카오 로그인 후 예약 생성 확인
- 콘솔에 CSP 오류가 없는지 확인 (`next.config.js` 의 CSP 가 API 주소를 자동으로 포함한다)

---

## 6. 백업 (필수)

`scripts/backup-db.sh` 가 DB 를 덤프해 `backups/` 에 남기고, 오래된 것을 지우고,
`BACKUP_RCLONE_REMOTE` 가 있으면 서버 밖에도 올린다.

**서버 디스크에만 두면 서버와 함께 사라진다.** 무료 서버는 조건이 언제든 바뀔
수 있으므로 원격 사본을 반드시 켠다. Oracle 계정 문제에 함께 묶이지 않도록
**다른 회사 저장소(Cloudflare R2 등)** 가 더 안전하다.

```bash
# rclone 설치 후 리모트 만들기 (예: Cloudflare R2 → 이름 r2)
curl https://rclone.org/install.sh | sudo bash
rclone config
# .env 에 BACKUP_RCLONE_REMOTE=r2:japko-backups

# 수동 실행으로 확인
scripts/backup-db.sh

# 매일 새벽 4시 자동 실행
crontab -e
0 4 * * * cd /home/ubuntu/newFront && scripts/backup-db.sh >> /home/ubuntu/backup.log 2>&1
```

복원은 `scripts/restore-db.sh backups/japko-YYYYMMDD-HHMMSS.sql.gz`.
**복원 연습을 한 번은 해 볼 것.** 한 번도 되살려 보지 않은 백업은 백업이 아니다.

---

## 7. 업데이트

```bash
cd ~/newFront
scripts/backup-db.sh           # 배포 전 백업
git pull
docker compose up -d --build
docker compose logs -f api     # 기동 로그 확인
```

---

## 8. 챗 백엔드를 붙일 때 (나중에)

mysql 컨테이너는 서버 안에서만 `127.0.0.1:3306` 으로 열려 있다.

- 챗 백엔드를 서버에 **compose 밖에서** 돌리면 `MYSQL_HOST=127.0.0.1` 로 붙는다.
- 같은 compose 에 서비스로 넣으면 `MYSQL_HOST=mysql` 로 붙는다.
- 챗 백엔드는 Kafka 를 쓴다. 메모리 12GB 안에서 같이 돌릴 수 있는지 그때 확인한다.
- 두 앱이 같은 테이블을 쓰므로 스키마 변경은 NULL/DEFAULT 로 호환되게 한다.

로컬에서 서버 DB 를 들여다볼 때는 포트를 열지 말고 SSH 터널을 쓴다.

```bash
ssh -L 13306:127.0.0.1:3306 ubuntu@<서버 IP>
# 다른 터미널에서
mysql -h127.0.0.1 -P13306 -ujapko -p japko_local
```

---

## 9. 로컬 개발

```bash
nvm use 22.19.0                                     # arm64 Mac 에서 x64 node 를 쓰면 sharp 오류
pnpm dev                                            # 웹 3000
cd backend && uvicorn main:app --reload --port 5000  # API 5000
```

로컬 `.env` 는 프론트 3000 / API 5000 / 맥의 MySQL 조합으로 맞춰져 있다.
compose 를 로컬에서 시험할 때는 `MYSQL_USER` 가 root 가 아니어야 한다.

---

## 10. 알려진 제약

- 송영(transfer) 예약은 관리자 견적 기능이 없어 견적 확정 전까지 결제가 진행되지 않는다.
  결제 시도 시 "견적 안내를 기다려 주세요" 안내가 표시된다.
- 자동화된 테스트가 없다. 배포 후 5장 점검 항목을 수동으로 확인할 것.

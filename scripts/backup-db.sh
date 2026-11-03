#!/usr/bin/env bash
# mysql 컨테이너의 DB 를 덤프해 backups/ 에 남긴다. cron 으로 매일 돌린다.
#
#   scripts/backup-db.sh
#
# - 덤프는 backups/japko-YYYYMMDD-HHMMSS.sql.gz
# - BACKUP_KEEP_DAYS(기본 14)일 넘은 로컬 덤프는 지운다
# - .env 에 BACKUP_RCLONE_REMOTE 가 있으면 rclone 으로 서버 밖에도 올린다
#   (예: oci:japko-backups). 서버가 통째로 사라져도 데이터가 남게 하려면 필수다.
#
# 비밀번호와 DB 이름은 mysql 컨테이너가 이미 가진 환경변수를 쓴다.
# .env 를 셸로 source 하지 않는다(값에 특수문자가 있으면 깨진다).
set -euo pipefail

cd "$(dirname "$0")/.."

read_env() {
  # .env 에서 KEY=VALUE 한 줄만 읽는다. 없으면 빈 문자열.
  grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

KEEP_DAYS="${BACKUP_KEEP_DAYS:-$(read_env BACKUP_KEEP_DAYS)}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE="${BACKUP_RCLONE_REMOTE:-$(read_env BACKUP_RCLONE_REMOTE)}"

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/japko-${STAMP}.sql.gz"
TMP="${OUT}.partial"

# --single-transaction: 테이블을 잠그지 않고 일관된 시점으로 뜬다(InnoDB).
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot \
     --single-transaction --routines --triggers --events \
     --set-gtid-purged=OFF --default-character-set=utf8mb4 "$MYSQL_DATABASE"' \
  </dev/null | gzip -9 > "$TMP"

# 덤프가 깨졌으면 기존 백업을 지우기 전에 멈춘다.
gzip -t "$TMP"
if ! gzip -dc "$TMP" | tail -n 1 | grep -q "Dump completed"; then
  echo "[backup] 덤프가 끝까지 기록되지 않았습니다: $TMP" >&2
  exit 1
fi
mv "$TMP" "$OUT"
echo "[backup] 저장: $OUT ($(du -h "$OUT" | cut -f1))"

find backups -name 'japko-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete \
  | sed 's/^/[backup] 오래된 백업 삭제: /'

if [ -n "$REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$OUT" "$REMOTE" && echo "[backup] 원격 업로드: $REMOTE"
    # 원격도 같은 기간만 보관한다.
    rclone delete --min-age "${KEEP_DAYS}d" --include 'japko-*.sql.gz' "$REMOTE" || true
  else
    echo "[backup] BACKUP_RCLONE_REMOTE 가 설정됐지만 rclone 이 없습니다. 원격 업로드 건너뜀" >&2
    exit 1
  fi
fi

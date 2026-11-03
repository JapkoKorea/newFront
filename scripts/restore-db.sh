#!/usr/bin/env bash
# 덤프 파일을 mysql 컨테이너의 DB 에 넣는다. 처음 서버로 데이터를 옮길 때와
# 백업에서 되살릴 때 쓴다.
#
#   scripts/restore-db.sh backups/japko-20261103-040000.sql.gz
#   scripts/restore-db.sh japko_local.sql          # 압축 안 된 것도 된다
#
# 덤프에 든 테이블은 덮어써진다(mysqldump 가 DROP TABLE 을 넣는다).
# 되돌릴 수 없으니 실행 전에 backup-db.sh 로 현재 상태를 먼저 떠 둔다.
set -euo pipefail

cd "$(dirname "$0")/.."

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "사용법: $0 <덤프파일.sql 또는 .sql.gz>" >&2
  exit 1
fi

# exec -T 는 표준입력을 읽어 간다. 아래 확인 입력을 먹지 않도록 /dev/null 을 준다.
DB="$(docker compose exec -T mysql sh -c 'printf %s "$MYSQL_DATABASE"' </dev/null)"
printf '%s 를 DB "%s" 에 덮어씁니다. 계속하려면 yes 입력: ' "$FILE" "$DB"
read -r answer || answer=""
[ "$answer" = "yes" ] || { echo "취소했습니다."; exit 1; }

case "$FILE" in
  *.gz) READ=(gzip -dc "$FILE") ;;
  *)    READ=(cat "$FILE") ;;
esac

"${READ[@]}" | docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4 "$MYSQL_DATABASE"'

# 앱 계정(MYSQL_USER)이 복원된 테이블을 쓸 수 있는지 확인한다.
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()" "$MYSQL_DATABASE"' </dev/null \
  | sed 's/^/[restore] 테이블 수: /'
echo "[restore] 완료. 앱을 재시작하세요: docker compose restart api"

"""이용 후기 — 작성 자격 판정, 저장, 집계.

핵심 규칙은 하나다. **이용을 마친 사람만 쓴다.**
예약 상태가 completed 인 예약에 대해서만 후기를 받는다. 이 검증이 있어야
화면에 "이용 완료 확인됨"을 붙일 수 있고, 그게 후기의 신뢰를 만든다.

출처(source)는 데이터에서부터 가른다. 자체 후기(own)와 네이버 후기(naver)를
같은 테이블에 두되 섞지 않는다. 평점 집계는 자체 후기만 대상으로 한다 —
검증할 수 없는 외부 후기를 우리 평점으로 신고하면 정책 위반이다.
"""

import json
from datetime import datetime
from typing import Any

from services.mysql_user_service import _connect


# 후기를 쓸 수 있는 예약 상태.
REVIEWABLE_STATUSES = {"completed"}

RATING_MIN = 1
RATING_MAX = 5
BODY_MAX_LENGTH = 2000

# 작성 화면에서 고르는 태그. 이 서비스의 실제 강점에서 뽑았다.
# 값을 늘리면 프론트(ReviewModal)의 목록도 함께 고쳐야 한다.
ALLOWED_TAGS = [
    "기사님 친절",
    "사진 포인트",
    "시간 여유",
    "눈길 안전",
    "코스 구성",
    "설명 자세함",
]

VISIBLE = "visible"
HIDDEN = "hidden"
REPORTED = "reported"


class ReviewError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def ensure_review_tables() -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reviews (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    source VARCHAR(16) NOT NULL DEFAULT 'own',
                    reservation_number CHAR(36) NULL,
                    user_id CHAR(36) NULL,
                    product_slug VARCHAR(64) NULL,
                    course_id VARCHAR(64) NULL,
                    rating TINYINT UNSIGNED NOT NULL,
                    body TEXT NULL,
                    tags TEXT NULL,
                    status VARCHAR(16) NOT NULL DEFAULT 'visible',
                    author_display VARCHAR(64) NULL,
                    external_id VARCHAR(128) NULL,
                    external_url VARCHAR(500) NULL,
                    hidden_reason VARCHAR(255) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    -- 예약 1건당 후기 1개. 자체 후기에만 걸린다(네이버는 NULL).
                    UNIQUE KEY uq_review_reservation (reservation_number),
                    KEY idx_review_product (product_slug, status, created_at),
                    KEY idx_review_course (course_id, status, created_at),
                    KEY idx_review_status (status, created_at),
                    UNIQUE KEY uq_review_external (source, external_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 사진은 파일 자체가 아니라 저장소 경로만 남긴다.
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS review_photos (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    review_id BIGINT UNSIGNED NOT NULL,
                    url VARCHAR(500) NOT NULL,
                    seq SMALLINT UNSIGNED NOT NULL DEFAULT 1,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_photo_review (review_id, seq),
                    CONSTRAINT fk_photo_review FOREIGN KEY (review_id)
                        REFERENCES reviews(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 상품별 집계. courses 에는 이미 rating_avg/rating_count 가 있다.
            for ddl in [
                "ALTER TABLE courses ADD COLUMN rating_avg DECIMAL(2,1) NOT NULL DEFAULT 0.0",
                "ALTER TABLE courses ADD COLUMN rating_count INT UNSIGNED NOT NULL DEFAULT 0",
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass  # 이미 있으면 무시
        conn.commit()
    finally:
        conn.close()


def mask_name(name: str | None) -> str:
    """표시용 이름. 원본은 저장하지 않는다. 홍길동 -> 홍OO"""
    text = (name or "").strip()
    if not text:
        return "익명"
    if len(text) == 1:
        return text
    return text[0] + "O" * (len(text) - 1)


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    for key in ("created_at", "updated_at"):
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    raw_tags = out.get("tags")
    if isinstance(raw_tags, str) and raw_tags:
        try:
            out["tags"] = json.loads(raw_tags)
        except ValueError:
            out["tags"] = []
    elif raw_tags is None:
        out["tags"] = []
    out["photos"] = out.get("photos") or []
    return out


def find_reviewable_reservation(user_id: str, reservation_number: str) -> dict[str, Any] | None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT reservation_number, user_id, status, desired_course, course_id,
                       product_slug, tour_date, english_name
                FROM reservations
                WHERE user_id = %s AND reservation_number = %s
                LIMIT 1
                """,
                (user_id, reservation_number),
            )
            return cursor.fetchone()
    finally:
        conn.close()


def get_review_by_reservation(reservation_number: str) -> dict[str, Any] | None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM reviews WHERE reservation_number = %s LIMIT 1",
                (reservation_number,),
            )
            row = cursor.fetchone()
            return _serialize(row) if row else None
    finally:
        conn.close()


def create_own_review(
    user_id: str,
    reservation_number: str,
    rating: int,
    body: str | None,
    tags: list[str] | None,
    display_name: str | None,
) -> int:
    """자체 후기를 저장한다. 이용 완료 예약에만 허용."""
    if not isinstance(rating, int) or not (RATING_MIN <= rating <= RATING_MAX):
        raise ReviewError("invalid_rating", "별점은 1점에서 5점 사이여야 합니다.")

    reservation = find_reviewable_reservation(user_id, reservation_number)
    if not reservation:
        raise ReviewError("not_found", "예약을 찾을 수 없습니다.")

    if reservation.get("status") not in REVIEWABLE_STATUSES:
        raise ReviewError(
            "not_reviewable",
            "이용을 마친 예약에만 후기를 남길 수 있습니다.",
        )

    if get_review_by_reservation(reservation_number) is not None:
        raise ReviewError("already_reviewed", "이미 이 예약에 후기를 남기셨습니다.")

    clean_tags = [t for t in (tags or []) if t in ALLOWED_TAGS]
    clean_body = (body or "").strip()[:BODY_MAX_LENGTH] or None

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reviews (
                    source, reservation_number, user_id, product_slug, course_id,
                    rating, body, tags, status, author_display
                ) VALUES ('own', %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    reservation_number,
                    user_id,
                    reservation.get("product_slug"),
                    reservation.get("course_id"),
                    rating,
                    clean_body,
                    json.dumps(clean_tags, ensure_ascii=False) if clean_tags else None,
                    VISIBLE,
                    mask_name(display_name or reservation.get("english_name")),
                ),
            )
            review_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    refresh_course_rating(reservation.get("course_id"))
    return review_id


def create_external_review(
    source: str,
    product_slug: str | None,
    rating: int,
    body: str | None,
    author_display: str | None,
    external_id: str,
    external_url: str | None = None,
    course_id: str | None = None,
) -> int:
    """외부(네이버 쇼핑 등) 후기를 등록한다.

    우리 예약과 이어지지 않으므로 reservation_number 가 없다. 같은 후기를
    두 번 넣지 않도록 (source, external_id) 를 유일 키로 쓴다 — 이미 있으면
    내용만 갱신한다.

    평점 집계에는 넣지 않는다(summarize_reviews 는 own 만 센다). 우리가
    검증할 수 없는 값이라 목록에 함께 보여주되 우리 평점으로 삼지 않는다.
    """
    if source == "own":
        raise ReviewError("invalid_source", "자체 후기는 예약을 통해 작성합니다.")
    if not isinstance(rating, int) or not (RATING_MIN <= rating <= RATING_MAX):
        raise ReviewError("invalid_rating", "별점은 1점에서 5점 사이여야 합니다.")
    if not (external_id or "").strip():
        raise ReviewError("external_id_required", "외부 후기 식별자가 필요합니다.")

    clean_body = (body or "").strip()[:BODY_MAX_LENGTH] or None
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reviews (
                    source, reservation_number, user_id, product_slug, course_id,
                    rating, body, status, author_display, external_id, external_url
                ) VALUES (%s, NULL, NULL, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    rating = VALUES(rating), body = VALUES(body),
                    author_display = VALUES(author_display),
                    external_url = VALUES(external_url),
                    product_slug = VALUES(product_slug)
                """,
                (
                    source, product_slug, course_id, rating, clean_body, VISIBLE,
                    mask_name(author_display), external_id.strip(), (external_url or "").strip() or None,
                ),
            )
            review_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()
    return review_id


def list_reviews(
    product_slug: str | None = None,
    course_id: str | None = None,
    source: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """공개된 후기 목록. 숨김·신고된 후기는 나오지 않는다.

    후기는 예약 상품 하나에 붙는다. 자유 코스로 예약해도 상품은 정해져
    있으므로, 코스가 아니라 product_slug 로 모은다. course_id 는 코스별로
    좁혀 볼 때만 쓰는 부가 필터다.
    """
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT * FROM reviews WHERE status = %s"
            params: list[Any] = [VISIBLE]
            if product_slug:
                sql += " AND product_slug = %s"
                params.append(product_slug)
            if course_id:
                sql += " AND course_id = %s"
                params.append(course_id)
            if source:
                sql += " AND source = %s"
                params.append(source)
            sql += " ORDER BY created_at DESC LIMIT %s"
            params.append(int(limit))

            cursor.execute(sql, tuple(params))
            rows = [_serialize(r) for r in cursor.fetchall()]

            if rows:
                ids = tuple(r["id"] for r in rows)
                placeholders = ",".join(["%s"] * len(ids))
                cursor.execute(
                    f"SELECT review_id, url FROM review_photos WHERE review_id IN ({placeholders}) ORDER BY seq",
                    ids,
                )
                by_review: dict[int, list[str]] = {}
                for photo in cursor.fetchall():
                    by_review.setdefault(photo["review_id"], []).append(photo["url"])
                for row in rows:
                    row["photos"] = by_review.get(row["id"], [])
            return rows
    finally:
        conn.close()


def summarize_reviews(product_slug: str | None = None, course_id: str | None = None) -> dict[str, Any]:
    """평점 요약. 자체 후기만 집계한다.

    외부 후기는 검증할 수 없어 우리 평점에 넣지 않는다. 화면에서도
    별도 줄로 나란히 보여준다.
    """
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            sql = """
                SELECT rating, COUNT(*) AS n
                FROM reviews
                WHERE status = %s AND source = 'own'
            """
            params: list[Any] = [VISIBLE]
            if product_slug:
                sql += " AND product_slug = %s"
                params.append(product_slug)
            if course_id:
                sql += " AND course_id = %s"
                params.append(course_id)
            sql += " GROUP BY rating"
            cursor.execute(sql, tuple(params))
            buckets = {int(r["rating"]): int(r["n"]) for r in cursor.fetchall()}
    finally:
        conn.close()

    total = sum(buckets.values())
    average = round(sum(k * v for k, v in buckets.items()) / total, 1) if total else 0.0
    return {
        "average": average,
        "count": total,
        "distribution": {str(score): buckets.get(score, 0) for score in range(5, 0, -1)},
    }


def summarize_by_product() -> dict[str, dict[str, Any]]:
    """상품별 평점 요약을 한 번에. 목록 화면이 카드마다 조회하지 않도록 한다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT product_slug, COUNT(*) AS n, AVG(rating) AS avg_rating
                FROM reviews
                WHERE status = %s AND source = 'own' AND product_slug IS NOT NULL
                GROUP BY product_slug
                """,
                (VISIBLE,),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    return {
        row["product_slug"]: {
            "count": int(row["n"]),
            "average": round(float(row["avg_rating"]), 1),
        }
        for row in rows
    }


def refresh_course_rating(course_id: str | None) -> None:
    """코스 집계를 갱신한다. 목록에서 매번 평균을 계산하지 않기 위함."""
    if not course_id:
        return
    summary = summarize_reviews(course_id=course_id)
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE courses SET rating_avg = %s, rating_count = %s WHERE id = %s",
                (summary["average"], summary["count"], course_id),
            )
        conn.commit()
    except Exception as error:
        conn.rollback()
        print(f"[WARN] course rating refresh failed ({course_id}): {error}")
    finally:
        conn.close()


# ── 운영자용 ────────────────────────────────────────────────

def list_reviews_for_admin(status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """운영자 목록. 신고된 후기가 먼저 나온다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT * FROM reviews"
            params: list[Any] = []
            if status:
                sql += " WHERE status = %s"
                params.append(status)
            sql += " ORDER BY (status = 'reported') DESC, created_at DESC LIMIT %s"
            params.append(int(limit))
            cursor.execute(sql, tuple(params))
            return [_serialize(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def set_review_status(review_id: int, status: str, reason: str | None = None) -> dict[str, Any]:
    if status not in {VISIBLE, HIDDEN, REPORTED}:
        raise ReviewError("invalid_status", "알 수 없는 상태입니다.")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, course_id FROM reviews WHERE id = %s LIMIT 1", (review_id,))
            row = cursor.fetchone()
            if not row:
                raise ReviewError("not_found", "후기를 찾을 수 없습니다.")
            cursor.execute(
                "UPDATE reviews SET status = %s, hidden_reason = %s WHERE id = %s",
                (status, (reason or "").strip() or None, review_id),
            )
        conn.commit()
    finally:
        conn.close()

    refresh_course_rating(row.get("course_id"))
    return {"reviewId": review_id, "status": status}


def report_review(review_id: int) -> dict[str, Any]:
    """고객 신고. 바로 숨기지 않고 운영자가 확인하도록 표시만 한다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE reviews SET status = %s WHERE id = %s AND status = %s",
                (REPORTED, review_id, VISIBLE),
            )
            changed = cursor.rowcount
        conn.commit()
    finally:
        conn.close()
    return {"reviewId": review_id, "reported": changed > 0}

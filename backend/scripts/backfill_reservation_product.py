"""기존 예약에 product_slug 를 채운다 (1회성).

후기는 예약 상품에 붙는다. product_slug 컬럼이 생기기 전에 만들어진 예약은
그 값이 비어 있어, 이용을 마쳐도 후기가 어느 상품에도 붙지 않는다.

판정 규칙은 services/product_catalog.py 한 곳에 있다 — 신규 예약을 받을 때와
같은 규칙이어야 과거·현재 예약이 다른 상품에 붙는 일이 없다.

    python backend/scripts/backfill_reservation_product.py [--apply]

--apply 없이 실행하면 무엇이 바뀔지만 보여준다.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from services.mysql_user_service import _connect  # noqa: E402
from services.product_catalog import resolve_product_slug  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="실제로 UPDATE 한다")
    args = parser.parse_args()

    conn = _connect()
    updated = skipped = 0
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT reservation_number, course_id, season, tour_date
                FROM reservations
                WHERE product_slug IS NULL AND service_type = 'tour'
                """
            )
            rows = cursor.fetchall()

            for row in rows:
                slug = resolve_product_slug(
                    course_id=row.get("course_id"),
                    season=row.get("season"),
                    tour_date=row.get("tour_date"),
                )
                if not slug:
                    skipped += 1
                    print(f"  건너뜀 {row['reservation_number']} (시즌 판정 불가: {row['tour_date']})")
                    continue
                print(f"  {row['reservation_number']} -> {slug}")
                if args.apply:
                    cursor.execute(
                        "UPDATE reservations SET product_slug = %s WHERE reservation_number = %s",
                        (slug, row["reservation_number"]),
                    )
                updated += 1
        if args.apply:
            conn.commit()
    finally:
        conn.close()

    mode = "적용" if args.apply else "미리보기"
    print(f"\n[{mode}] 대상 {updated}건, 건너뜀 {skipped}건")


if __name__ == "__main__":
    main()

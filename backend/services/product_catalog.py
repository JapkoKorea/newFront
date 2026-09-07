"""예약이 속한 상품을 판정한다.

상품 정의 자체는 프론트(src/products)에 있고 서버는 slug 만 저장한다.
그런데 웹이 아닌 경로(모바일 앱, 카카오/LINE 챗)로 들어온 예약은 slug 를
실어 보내지 않는다. 그 예약도 이용을 마치면 후기를 남길 수 있어야 하므로,
서버가 시즌과 코스로 상품을 되짚는다.

상품이 늘거나 시즌 구성이 바뀌면 프론트 카탈로그와 함께 여기도 고친다.
"""

from datetime import date, datetime


SEASON_PRODUCT = {
    "winter": "winter-taxi-tour",
    "summer": "summer-taxi-tour",
}

# 한 시즌에만 있는 코스. 양쪽에 다 있는 코스(standard, nature 등)는
# 날짜로 갈라야 하므로 여기 넣지 않는다.
COURSE_PRODUCT = {
    "snow-drive": "winter-taxi-tour",
    "winter-falls": "winter-taxi-tour",
    "lavender-road": "summer-taxi-tour",
    "flower-hill": "summer-taxi-tour",
    "extended": "summer-taxi-tour",
}

WINTER_MONTHS = {11, 12, 1, 2, 3}
SUMMER_MONTHS = {6, 7, 8, 9}


def season_of(tour_date: date | str | None) -> str | None:
    """투어 날짜의 시즌. 4~5월·10월은 어느 시즌 상품도 아니어서 None.

    요청 본문의 날짜는 문자열("2026-12-01")로 들어오고 DB 에서 읽으면
    date 다. 양쪽 다 받는다.
    """
    if not tour_date:
        return None
    if isinstance(tour_date, str):
        try:
            tour_date = datetime.strptime(tour_date[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    if tour_date.month in WINTER_MONTHS:
        return "winter"
    if tour_date.month in SUMMER_MONTHS:
        return "summer"
    return None


def resolve_product_slug(
    course_id: str | None = None,
    season: str | None = None,
    tour_date: date | str | None = None,
) -> str | None:
    """코스 -> 시즌 순으로 상품을 찾는다. 판정할 수 없으면 None."""
    if course_id and course_id in COURSE_PRODUCT:
        return COURSE_PRODUCT[course_id]
    return SEASON_PRODUCT.get(season or season_of(tour_date) or "")

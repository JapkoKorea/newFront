"""코스/관광지 마스터 카탈로그 + 유저 role.

DB_DESIGN.md 2장(코스/관광지 마스터)과 3.1(users.role)의 구현.
시드 출처는 웹 `src/data/tourCourses.js`(superset). 좌표는 Flutter 카탈로그에서 병합.
공유 DB(japko_local)이므로 모든 변경은 추가형(IF NOT EXISTS / ADD COLUMN)으로만 한다.
"""
from typing import Any

from services.mysql_user_service import _connect


def ensure_catalog_tables() -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS spots (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    name VARCHAR(150) NOT NULL,
                    name_ja VARCHAR(150) NULL,
                    name_en VARCHAR(150) NULL,
                    category VARCHAR(24) NOT NULL DEFAULT 'attraction',
                    region VARCHAR(24) NULL,
                    lat DECIMAL(10,7) NULL,
                    lng DECIMAL(10,7) NULL,
                    google_place_id VARCHAR(255) NULL,
                    address VARCHAR(255) NULL,
                    stay_minutes SMALLINT UNSIGNED NULL,
                    photo_point VARCHAR(255) NULL,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_spot_place (google_place_id),
                    KEY idx_spot_category_region (category, region),
                    KEY idx_spot_name (name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS courses (
                    id VARCHAR(64) NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    summary VARCHAR(255) NULL,
                    description TEXT NULL,
                    region VARCHAR(24) NULL,
                    departure_name VARCHAR(150) NULL,
                    destination_name VARCHAR(150) NULL,
                    duration_hours DECIMAL(4,1) NOT NULL DEFAULT 4.0,
                    duration_label VARCHAR(20) NULL,
                    base_price_jpy INT UNSIGNED NULL,
                    deposit_krw INT UNSIGNED NULL DEFAULT 15000,
                    badge VARCHAR(40) NULL,
                    hero_image_url VARCHAR(500) NULL,
                    rating_avg DECIMAL(2,1) NOT NULL DEFAULT 0.0,
                    rating_count INT UNSIGNED NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    sort_order INT NOT NULL DEFAULT 0,
                    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (id),
                    KEY idx_course_active_sort (is_active, sort_order)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS course_seasons (
                    course_id VARCHAR(64) NOT NULL,
                    season VARCHAR(16) NOT NULL,
                    PRIMARY KEY (course_id, season),
                    CONSTRAINT fk_cseason_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS course_spots (
                    course_id VARCHAR(64) NOT NULL,
                    seq SMALLINT UNSIGNED NOT NULL,
                    spot_id BIGINT UNSIGNED NOT NULL,
                    PRIMARY KEY (course_id, seq),
                    KEY idx_cspot_spot (spot_id),
                    CONSTRAINT fk_cspot_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                    CONSTRAINT fk_cspot_spot FOREIGN KEY (spot_id) REFERENCES spots(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS course_images (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    course_id VARCHAR(64) NOT NULL,
                    seq SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                    url VARCHAR(500) NOT NULL,
                    PRIMARY KEY (id),
                    KEY idx_cimg_course (course_id, seq),
                    CONSTRAINT fk_cimg_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )
            # 공유 users 테이블에 role 추가 (추가형, 기존 행은 default 'customer')
            # reservations.course_id -> courses(id) FK은 courses 생성 이후라 여기서 건다.
            for ddl in [
                "ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'customer'",
                "ALTER TABLE users ADD KEY idx_user_role (role)",
                "ALTER TABLE reservations ADD CONSTRAINT fk_res_course FOREIGN KEY (course_id) REFERENCES courses(id)",
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass  # 이미 존재하거나 선행 컬럼 부재 시 무시
        conn.commit()
    finally:
        conn.close()


# 관광지/역/공항 마스터. (name, category, region, lat, lng, stay_minutes, photo_point)
# 좌표: mobile tour_detail_page.dart `_knownLocations`. 가이드: 웹 spotGuideData.
_SPOTS: list[tuple[str, str, str, float | None, float | None, int | None, str | None]] = [
    ("아사히카와역", "station", "asahikawa", 43.7637, 142.3578, None, None),
    ("비에이역", "station", "biei", 43.5888, 142.4649, None, None),
    ("후라노역", "station", "furano", 43.3418, 142.3832, None, None),
    ("아사히카와 공항", "airport", "asahikawa", 43.6711, 142.4475, None, None),
    ("크리스마스 나무", "attraction", "biei", 43.5928, 142.4672, 20, "정면 도로 쪽에서 단독 트리 구도를 잡기 좋아요."),
    ("세븐스타 나무", "attraction", "biei", 43.5902, 142.4551, 20, "일몰 전 역광 타이밍이 사진 색감이 가장 좋아요."),
    ("켄과 메리 나무", "attraction", "biei", 43.5743, 142.4526, 15, "길을 배경으로 나무를 세로 프레임으로 담기 좋습니다."),
    ("마일드세븐 언덕", "attraction", "biei", 43.5794, 142.4305, 20, "언덕 라인이 보이는 높은 지점에서 촬영 추천."),
    ("탁신관", "attraction", "biei", 43.5619, 142.4469, 30, "라벤더 시즌에는 입구 주변 색감이 가장 선명합니다."),
    ("흰수염폭포", "attraction", "biei", 43.4922, 142.6353, 25, "다리 중앙 지점에서 폭포 전경을 넓게 담아보세요."),
    ("청의 호수", "attraction", "biei", 43.4936, 142.6147, 35, "산책로 첫 포인트가 호수 색을 가장 진하게 볼 수 있어요."),
    ("패치워크의 길", "attraction", "biei", 43.6008, 142.4442, 25, "넓은 화각으로 구릉지 패턴을 담으면 대표 컷이 됩니다."),
    ("닝구르 테라스", "attraction", "furano", 43.3403, 142.3847, 40, "해 질 무렵 조명 켜지는 시간대 방문을 추천합니다."),
    ("팜 토미타", "attraction", "furano", 43.4181, 142.4210, 50, "라벤더 밭 중앙 동선에서 파노라마 촬영 추천."),
    ("사계채언덕 (四季彩の丘)", "attraction", "biei", 43.5868, 142.4578, 45, "전망 포인트에서 꽃밭 층을 배경으로 촬영하기 좋아요."),
    ("아사히야마 동물원", "attraction", "asahikawa", 43.7686, 142.4804, 70, "펭귄/물개 관찰관 앞 대기 시간을 고려해 주세요."),
]


# 코스 마스터. 웹 tourCourses.js에서 이관, 'custom'(직접 만들기 placeholder) 제외, badge 이모지 제거.
_COURSES: list[dict[str, Any]] = [
    {
        "id": "snow-drive", "name": "설경 드라이브 코스", "duration_hours": 3.0, "duration_label": "3시간",
        "departure": "아사히카와역", "destination": "비에이역", "badge": "겨울 추천",
        "description": "순백의 설원과 눈 덮인 나무들을 드라이브하며 감상. 겨울 비에이의 핵심 루트.",
        "seasons": ["winter"], "spots": ["크리스마스 나무", "켄과 메리 나무", "마일드세븐 언덕"],
    },
    {
        "id": "winter-falls", "name": "빙결 폭포·호수 코스", "duration_hours": 4.0, "duration_label": "4시간",
        "departure": "아사히카와역", "destination": "아사히카와역", "badge": "겨울 한정",
        "description": "겨울에만 볼 수 있는 빙결 흰수염폭포와 설원의 청의 호수. 특별한 겨울 풍경.",
        "seasons": ["winter"], "spots": ["청의 호수", "흰수염폭포", "크리스마스 나무"],
    },
    {
        "id": "lavender-road", "name": "라벤더 로드 코스", "duration_hours": 4.0, "duration_label": "4시간",
        "departure": "비에이역", "destination": "후라노역", "badge": "여름 추천",
        "description": "7~8월 라벤더 절정기에 맞춘 후라노~비에이 꽃길 루트. 보라빛 풍경 속 드라이브.",
        "seasons": ["summer"], "spots": ["팜 토미타", "닝구르 테라스", "패치워크의 길"],
    },
    {
        "id": "flower-hill", "name": "꽃의 언덕 파노라마 코스", "duration_hours": 3.0, "duration_label": "3시간",
        "departure": "아사히카와역", "destination": "비에이역", "badge": "여름 한정",
        "description": "형형색색 꽃밭 언덕이 펼쳐지는 여름 비에이. 사계채언덕의 꽃 층을 파노라마로.",
        "seasons": ["summer"], "spots": ["사계채언덕 (四季彩の丘)", "패치워크의 길", "세븐스타 나무"],
    },
    {
        "id": "standard", "name": "스탠다드 비에이 명소 코스", "duration_hours": 3.0, "duration_label": "3시간",
        "departure": "아사히카와역", "destination": "비에이역", "badge": None,
        "description": "가장 인기 있는 정석 루트. 짧은 시간 안에 비에이의 대표 명소를 둘러보는 코스.",
        "seasons": ["winter", "summer", "all_season"], "spots": ["크리스마스 나무", "탁신관", "흰수염폭포"],
    },
    {
        "id": "nature", "name": "비에이 자연 감성 코스", "duration_hours": 3.0, "duration_label": "3시간",
        "departure": "아사히카와역", "destination": "비에이역", "badge": None,
        "description": "사진 촬영을 좋아하거나 자연경관 중심의 여유로운 투어를 원하는 분께 추천.",
        "seasons": ["winter", "summer", "all_season"], "spots": ["세븐스타 나무", "켄과 메리 나무", "마일드세븐 언덕", "청의 호수"],
    },
    {
        "id": "family", "name": "가족 맞춤 코스", "duration_hours": 3.0, "duration_label": "3시간",
        "departure": "아사히카와역", "destination": "아사히카와역", "badge": None,
        "description": "아이가 있는 가족에게 적합한 코스. 동물원 + 가벼운 자연 관광 조합.",
        "seasons": ["winter", "summer", "all_season"], "spots": ["크리스마스 나무", "사계채언덕 (四季彩の丘)", "아사히야마 동물원"],
    },
    {
        "id": "extended", "name": "비에이~후라노 확장 코스", "duration_hours": 4.0, "duration_label": "4-6시간",
        "departure": "비에이역", "destination": "아사히카와역", "badge": None,
        "description": "꽃이 피는 계절(6~8월)에는 후라노까지 연결된 장거리 루트로 추천.",
        "seasons": ["summer", "all_season"], "spots": ["청의 호수", "흰수염폭포", "닝구르 테라스", "팜 토미타"],
    },
    {
        "id": "photo", "name": "감성 사진 명소 투어", "duration_hours": 4.0, "duration_label": "4-6시간",
        "departure": "아사히카와역", "destination": "아사히카와역", "badge": None,
        "description": "사진 찍기 좋은 장소들만 모아 구성. 인스타 감성 코스로 인기.",
        "seasons": ["winter", "summer", "all_season"],
        "spots": ["세븐스타 나무", "켄과 메리 나무", "마일드세븐 언덕", "패치워크의 길", "크리스마스 나무"],
    },
]


def _get_or_create_spot(cursor: Any, name: str) -> int:
    cursor.execute("SELECT id FROM spots WHERE name = %s LIMIT 1", (name,))
    row = cursor.fetchone()
    if row:
        return row["id"]
    cursor.execute(
        "INSERT INTO spots (name, category, region) VALUES (%s, 'attraction', NULL)",
        (name,),
    )
    return cursor.lastrowid


def seed_catalog() -> None:
    """코스/관광지 시드. 이미 존재하는 코스/스팟은 건드리지 않는다(비파괴, 재실행 안전)."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            name_to_id: dict[str, int] = {}
            for name, category, region, lat, lng, stay, photo in _SPOTS:
                cursor.execute("SELECT id FROM spots WHERE name = %s LIMIT 1", (name,))
                row = cursor.fetchone()
                if row:
                    name_to_id[name] = row["id"]
                    continue
                cursor.execute(
                    """
                    INSERT INTO spots (name, category, region, lat, lng, stay_minutes, photo_point)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (name, category, region, lat, lng, stay, photo),
                )
                name_to_id[name] = cursor.lastrowid

            for order, course in enumerate(_COURSES, start=1):
                cursor.execute("SELECT id FROM courses WHERE id = %s", (course["id"],))
                if cursor.fetchone():
                    continue
                cursor.execute(
                    """
                    INSERT INTO courses (
                        id, name, description, region, departure_name, destination_name,
                        duration_hours, duration_label, deposit_krw, badge, sort_order
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        course["id"], course["name"], course["description"], "biei",
                        course["departure"], course["destination"],
                        course["duration_hours"], course["duration_label"], 15000,
                        course["badge"], order,
                    ),
                )
                for season in course["seasons"]:
                    cursor.execute(
                        "INSERT INTO course_seasons (course_id, season) VALUES (%s, %s)",
                        (course["id"], season),
                    )
                for seq, spot_name in enumerate(course["spots"], start=1):
                    spot_id = name_to_id.get(spot_name) or _get_or_create_spot(cursor, spot_name)
                    name_to_id[spot_name] = spot_id
                    cursor.execute(
                        "INSERT INTO course_spots (course_id, seq, spot_id) VALUES (%s, %s, %s)",
                        (course["id"], seq, spot_id),
                    )
        conn.commit()
    finally:
        conn.close()

import os
from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter()

SITE_URL = os.getenv("SITE_URL", "https://japko.kr")

# 투어 코스 슬러그 목록 — tourCourses.js의 id와 동기화 유지
TOUR_IDS = [
    "snow-drive",
    "winter-falls",
    "lavender-road",
    "flower-hill",
    "standard",
    "nature",
    "family",
    "extended",
    "photo",
    "custom",
]

# 가이드 슬러그 목록 — guideContent.js의 slug와 동기화 유지
GUIDE_SLUGS = [
    "biei",
    "furano",
    "best-season",
    "taxi-vs-rental-car",
]

STATIC_PAGES = [
    {"loc": "/", "priority": "1.0", "changefreq": "weekly"},
    {"loc": "/tours", "priority": "0.9", "changefreq": "weekly"},
    {"loc": "/guide", "priority": "0.9", "changefreq": "monthly"},
    {"loc": "/pricing", "priority": "0.8", "changefreq": "monthly"},
]


def _url_entry(loc: str, priority: str = "0.7", changefreq: str = "monthly") -> str:
    return (
        f"  <url>\n"
        f"    <loc>{SITE_URL}{loc}</loc>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    entries: list[str] = []

    for page in STATIC_PAGES:
        entries.append(_url_entry(page["loc"], page["priority"], page["changefreq"]))

    for tour_id in TOUR_IDS:
        entries.append(_url_entry(f"/tours/{tour_id}", priority="0.8", changefreq="monthly"))

    for slug in GUIDE_SLUGS:
        entries.append(_url_entry(f"/guide/{slug}", priority="0.8", changefreq="monthly"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@router.get("/robots.txt", include_in_schema=False)
async def robots():
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /payments/\n"
        "Disallow: /reservations\n"
        "Disallow: /login\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )
    return Response(content=content, media_type="text/plain")

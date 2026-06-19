from typing import Any, Literal

from fastapi import APIRouter, HTTPException

from services.mysql_catalog_service import get_course, list_courses


router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("")
async def get_courses(
    season: Literal["winter", "summer", "all_season"] | None = None,
) -> dict[str, Any]:
    """홈 커머스 피드용 코스 목록. 비로그인 허용(탐색)."""
    return {"courses": list_courses(season)}


@router.get("/{course_id}")
async def get_course_detail(course_id: str) -> dict[str, Any]:
    course = get_course(course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

"""이용 후기 API.

작성은 이용을 마친 예약자만 가능하다(review_service.REVIEWABLE_STATUSES).
조회는 로그인 없이 열려 있다 — 후기는 예약을 고민하는 사람에게 보여야 한다.
"""

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from dependencies.auth import get_current_user
from services.review_service import (
    ALLOWED_TAGS,
    BODY_MAX_LENGTH,
    ReviewError,
    create_own_review,
    find_reviewable_reservation,
    get_review_by_reservation,
    list_reviews,
    report_review,
    summarize_by_course,
    summarize_reviews,
)


router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewInput(BaseModel):
    reservation_number: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)
    body: str | None = Field(default=None, max_length=BODY_MAX_LENGTH)
    tags: list[str] | None = None
    product_slug: str | None = None


@router.get("")
async def get_reviews(
    product_slug: str | None = Query(None),
    course_ids: str | None = Query(None, description="쉼표로 구분한 코스 id. 상품 = 코스 묶음"),
    source: Literal["own", "naver"] | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """공개 후기 목록과 평점 요약. 로그인 불필요."""
    ids = [c.strip() for c in (course_ids or "").split(",") if c.strip()] or None
    return {
        "reviews": list_reviews(product_slug=product_slug, course_ids=ids, source=source, limit=limit),
        "summary": summarize_reviews(product_slug=product_slug, course_ids=ids),
        "allowedTags": ALLOWED_TAGS,
    }


@router.get("/summaries")
async def get_summaries():
    """코스별 평점 요약. 목록/홈 카드가 한 번에 받아 상품 단위로 합친다."""
    return {"summaries": summarize_by_course()}


@router.get("/eligibility/{reservation_number}")
async def check_eligibility(
    reservation_number: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """이 예약에 후기를 쓸 수 있는지. 화면이 버튼을 열고 닫는 데 쓴다."""
    user_id = str(current_user.get("user_id") or "").strip()
    reservation = find_reviewable_reservation(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다.")

    existing = get_review_by_reservation(reservation_number)
    completed = reservation.get("status") == "completed"

    if existing:
        notice = "이미 후기를 남기셨습니다."
    elif completed:
        notice = "투어는 어떠셨나요? 후기를 남겨 주세요."
    else:
        notice = "이용을 마친 뒤에 후기를 남길 수 있습니다."

    return {
        "canWrite": completed and existing is None,
        "alreadyWritten": existing is not None,
        "review": existing,
        "notice": notice,
        "allowedTags": ALLOWED_TAGS,
        "course": reservation.get("desired_course"),
    }


@router.post("")
async def write_review(
    payload: ReviewInput,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    try:
        review_id = create_own_review(
            user_id=user_id,
            reservation_number=payload.reservation_number,
            rating=payload.rating,
            body=payload.body,
            tags=payload.tags,
            display_name=current_user.get("nickname") or current_user.get("display_name"),
            product_slug=payload.product_slug,
        )
    except ReviewError as error:
        status_code = 404 if error.code == "not_found" else 409 if error.code in {"already_reviewed", "not_reviewable"} else 400
        raise HTTPException(status_code=status_code, detail=error.message) from error

    return {"message": "후기가 등록되었습니다. 감사합니다.", "reviewId": review_id}


@router.post("/{review_id}/report")
async def report(
    review_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """부적절한 후기 신고. 바로 숨기지 않고 운영자가 확인한다."""
    return report_review(review_id)

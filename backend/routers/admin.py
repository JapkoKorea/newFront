"""운영자용 API.

권한은 users.role 로 판정하며, 토큰이 아니라 매 요청 DB 에서 읽는다
(dependencies/auth.py 의 get_current_admin 참고).

예약 변경 요청 처리와 상담 인박스를 다룬다. 예약 확정/거절 등 다른 운영
동작은 필요해질 때 이 라우터에 추가한다.
"""

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from dependencies.auth import get_current_admin
from services.change_request_service import (
    ChangeRequestError,
    get_change_request,
    list_all_change_requests,
    resolve_change_request,
)
from services.reservation_admin_service import (
    ReservationAdminError,
    change_reservation_status,
    get_reservation_for_admin,
    list_reservations_for_admin,
    list_status_history,
)
from services.manual_payment_service import (
    ManualPaymentError,
    auto_verify_naver,
    confirm as confirm_manual_payment,
    list_for_reservations as list_payment_records,
    revert as revert_manual_payment,
)
from services.review_service import (
    ReviewError,
    create_external_review,
    list_reviews_for_admin,
    set_review_status,
)
from services.mysql_chat_service import (
    create_admin_message,
    list_conversations_for_admin,
    list_messages_for_admin,
)


router = APIRouter(prefix="/api/admin", tags=["admin"])


class ReservationStatusPayload(BaseModel):
    status: Literal["confirmed", "rejected", "cancelled", "completed"]
    reason: str | None = Field(default=None, max_length=255)


class ResolvePayload(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: str | None = Field(default=None, max_length=1000)


@router.get("/me")
async def whoami(current_admin: dict[str, Any] = Depends(get_current_admin)):
    """관리자 화면 진입 시 권한 확인용."""
    return {
        "userId": current_admin.get("user_id"),
        "displayName": current_admin.get("display_name"),
        "role": current_admin.get("role"),
    }


@router.get("/reservations")
async def get_reservations(
    status: Literal["pending", "confirmed", "rejected", "cancelled", "completed"] | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """예약 목록. 처리해야 할 접수 건이 먼저 나온다.

    결제 기록(어디서 결제했다고 알렸는지, 스토어 주문번호, 금액)을 붙여 준다.
    운영자가 통장을 볼지 스토어를 볼지 목록에서 바로 알 수 있어야 한다.
    """
    reservations = list_reservations_for_admin(status=status, limit=limit)
    records = list_payment_records([r["reservation_number"] for r in reservations])
    for item in reservations:
        item["payment_record"] = records.get(item["reservation_number"])
    return {"reservations": reservations}


@router.patch("/reservations/{reservation_number}/status")
async def update_reservation_status(
    reservation_number: str,
    payload: ReservationStatusPayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """예약을 확정하거나 반려한다.

    결제와 무관하다. 결제 승인은 payment_status 만 다루고, 확정 여부는
    배차 확인 결과이므로 운영자가 정한다.
    """
    admin_id = str(current_admin.get("user_id") or "").strip()

    reservation = get_reservation_for_admin(reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다.")

    # 상태 변경은 결제·결제취소를 건드리지 않는다. 결제가 아직 라이브가
    # 아니어서 의도적으로 떼어 둔 상태다. 환불 규칙은
    # refund_service.calculate_refund_krw 에 그대로 있고, 결제를 붙일 때
    # 여기서 호출하면 된다(RESERVATION_CHANGE_PLAN.md 9장).

    try:
        result = change_reservation_status(
            reservation_number=reservation_number,
            new_status=payload.status,
            admin_user_id=admin_id,
            reason=payload.reason,
        )
    except ReservationAdminError as error:
        status_code = 404 if error.code == "not_found" else 409
        raise HTTPException(status_code=status_code, detail=error.message) from error

    return {
        "message": "상태를 변경했습니다.",
        **result,
        "reservation": get_reservation_for_admin(reservation_number),
    }


@router.get("/change-requests")
async def get_change_requests(
    status: Literal["pending", "approved", "rejected", "cancelled"] | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """변경 요청 목록. 대기 중인 것이 먼저 나온다."""
    return {"requests": list_all_change_requests(status=status, limit=limit)}


@router.patch("/change-requests/{request_id}")
async def resolve_request(
    request_id: int,
    payload: ResolvePayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """변경 요청을 승인하거나 거절한다.

    승인하면 예약 일정이 실제로 갱신되고 이력이 남는다.
    """
    admin_id = str(current_admin.get("user_id") or "").strip()

    try:
        result = resolve_change_request(
            request_id=request_id,
            decision=payload.status,
            admin_user_id=admin_id,
            admin_note=payload.admin_note,
        )
    except ChangeRequestError as error:
        status_code = 404 if error.code == "not_found" else 409
        raise HTTPException(status_code=status_code, detail=error.message) from error

    return {
        "message": "승인했습니다." if payload.status == "approved" else "거절했습니다.",
        **result,
        "request": get_change_request(request_id),
    }


class AdminReplyPayload(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.get("/conversations")
async def get_conversations(
    unanswered: bool = Query(False, description="답변이 필요한 대화만"),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """상담 인박스 목록.

    unanswered 는 마지막 고객 메시지 이후 운영자 답변이 없는 대화다.
    봇 응답은 답변으로 치지 않는다.
    """
    return {"conversations": list_conversations_for_admin(only_unanswered=unanswered, limit=limit)}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    after: int = Query(0, ge=0),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    return {"messages": list_messages_for_admin(conversation_id, after)}


@router.post("/conversations/{conversation_id}/messages")
async def reply_to_conversation(
    conversation_id: str,
    payload: AdminReplyPayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """운영자 답변. 고객 화면에는 폴링으로 곧 나타난다."""
    message = create_admin_message(conversation_id, payload.body.strip())
    if message is None:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")
    return {"message": message}


class ReviewStatusPayload(BaseModel):
    status: Literal["visible", "hidden"]
    reason: str | None = Field(default=None, max_length=500)


@router.get("/reviews")
async def get_reviews(
    status: Literal["visible", "hidden", "reported"] | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """후기 목록. status=reported 로 신고된 후기부터 처리한다."""
    return {"reviews": list_reviews_for_admin(status=status, limit=limit)}


@router.patch("/reviews/{review_id}")
async def update_review_status(
    review_id: int,
    payload: ReviewStatusPayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """후기 노출/숨김 전환. 삭제하지 않고 숨겨서 기록을 남긴다."""
    try:
        return set_review_status(review_id, payload.status, payload.reason)
    except ReviewError as error:
        status_code = 404 if error.code == "not_found" else 400
        raise HTTPException(status_code=status_code, detail=error.message) from error


class PaymentStatusPayload(BaseModel):
    payment_status: Literal["paid", "unpaid"]
    # 결제를 확인하면서 예약까지 확정할지. 입금은 됐는데 배차가 안 되는 경우가
    # 있어 기본값은 False 다 — 두 판단은 별개다.
    confirm_reservation: bool = False


@router.patch("/reservations/{reservation_number}/payment")
async def update_payment_status(
    reservation_number: str,
    payload: PaymentStatusPayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """결제 확인. 통장이나 스토어 주문을 보고 결제 완료로 바꾸거나 되돌린다.

    결제 원장(reservation_payments)도 함께 갱신한다. 예약 상태는 기본적으로
    건드리지 않되, confirm_reservation 을 주면 확정까지 한 번에 처리한다.
    운영자가 화면에서 한 번에 누르더라도 서버에서는 두 동작이 구분된다.
    """
    admin_id = str(current_admin.get("user_id") or "").strip()
    try:
        if payload.payment_status == "paid":
            result = confirm_manual_payment(reservation_number, admin_id)
        else:
            result = revert_manual_payment(reservation_number)
    except ManualPaymentError as error:
        status_code = 404 if error.code == "not_found" else 400
        raise HTTPException(status_code=status_code, detail=error.message) from error

    if payload.confirm_reservation and payload.payment_status == "paid":
        try:
            change_reservation_status(reservation_number, "confirmed", "결제 확인")
            result["reservationStatus"] = "confirmed"
        except ReservationAdminError as error:
            # 결제 확인은 이미 끝났다. 예약 확정만 못 한 이유를 알려 준다.
            result["reservationStatus"] = None
            result["reservationError"] = error.message

    return {"reservationNumber": reservation_number, **result}


@router.post("/reservations/{reservation_number}/payment/verify-naver")
async def verify_naver_payment(
    reservation_number: str,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """스마트스토어 주문을 판매자 API 로 대조한다.

    고객이 남긴 주문번호로 실제 주문·결제 상태·금액을 확인하고, 맞으면 결제
    완료로 바꾼다. 확신이 서지 않으면 아무것도 바꾸지 않고 이유를 돌려준다.
    """
    from services.manual_payment_service import list_for_reservations
    from services.mysql_user_service import _connect

    record = list_for_reservations([reservation_number]).get(reservation_number)
    if not record or record.get("channel") != "naver":
        raise HTTPException(status_code=400, detail="스마트스토어로 결제했다고 알린 예약이 아닙니다")

    order_id = (record.get("external_order_no") or "").strip()
    if not order_id:
        raise HTTPException(status_code=400, detail="고객이 남긴 주문번호가 없습니다")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT payment_amount_krw FROM reservations WHERE reservation_number = %s",
                (reservation_number,),
            )
            row = cursor.fetchone()
    finally:
        conn.close()

    expected = int((row or {}).get("payment_amount_krw") or record.get("amount_krw") or 0)
    result = auto_verify_naver(reservation_number, order_id, expected)
    # 원본 응답은 크고 화면에 필요 없다. 판단에 쓴 값만 돌려준다.
    order = result.get("order") or {}
    return {
        "reservationNumber": reservation_number,
        "confirmed": bool(result.get("confirmed")),
        "reason": result.get("reason"),
        "message": result.get("message"),
        "orderStatus": order.get("status"),
        "orderAmount": order.get("amount"),
        "expectedAmount": expected,
    }


@router.get("/integrations/naver")
async def naver_integration_status(
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """네이버 커머스 API 연결 상태. 키가 맞는지 토큰 발급으로 확인한다."""
    from services.naver_commerce_service import (
        NaverCommerceError,
        _issue_token,
        is_configured,
    )

    if not is_configured():
        return {
            "configured": False,
            "connected": False,
            "message": "NAVER_COMMERCE_CLIENT_ID / SECRET 이 설정되지 않았습니다",
        }

    try:
        _issue_token()
    except NaverCommerceError as error:
        return {"configured": True, "connected": False, "message": error.message}

    return {"configured": True, "connected": True, "message": "연결됨"}


@router.get("/reservations/history")
async def get_status_history(
    reservation_number: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """예약 처리 내역. 언제 무엇을 확정·반려했고 사유가 무엇이었는지."""
    return {"history": list_status_history(reservation_number=reservation_number, limit=limit)}


class ExternalReviewPayload(BaseModel):
    """스마트스토어 등 외부 후기를 옮겨 담을 때 쓴다."""

    source: Literal["naver"] = "naver"
    product_slug: str | None = None
    rating: int = Field(ge=1, le=5)
    body: str | None = Field(default=None, max_length=2000)
    author_display: str | None = Field(default=None, max_length=64)
    # 같은 후기를 두 번 넣지 않기 위한 식별자. 스토어 리뷰 번호나 주문번호.
    external_id: str = Field(min_length=1, max_length=128)
    external_url: str | None = Field(default=None, max_length=500)


@router.post("/reviews/external")
async def add_external_review(
    payload: ExternalReviewPayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """외부 후기 등록. 같은 external_id 로 다시 넣으면 내용만 갱신된다.

    우리 평점 집계에는 넣지 않는다 — 검증할 수 없는 값이라 목록에만 함께
    보여준다.
    """
    try:
        review_id = create_external_review(
            source=payload.source,
            product_slug=payload.product_slug,
            rating=payload.rating,
            body=payload.body,
            author_display=payload.author_display,
            external_id=payload.external_id,
            external_url=payload.external_url,
        )
    except ReviewError as error:
        raise HTTPException(status_code=400, detail=error.message) from error

    return {"reviewId": review_id, "message": "외부 후기를 등록했습니다."}

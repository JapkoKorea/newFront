import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies.auth import get_current_user
from services.mysql_reservation_service import (
    record_status_change,
    save_reservation_mysql,
)
from services.refund_service import refund_for_cancellation
from services.change_request_service import (
    ChangeRequestError,
    create_change_request,
    describe_window,
    has_pending_request,
    list_change_requests,
    validate_change_request,
    REASON_MAX_LENGTH,
)
from services.mysql_user_service import _connect


router = APIRouter(prefix="/api/reservations", tags=["reservations"])


class ChangeRequestPayload(BaseModel):
    """변경 희망 날짜/시간. 하나만 보내도 된다. 사유는 비워도 된다."""

    tour_date: str | None = None
    tour_start_time: str | None = None
    reason: str | None = Field(default=None, max_length=REASON_MAX_LENGTH)


class RoutePointInput(BaseModel):
    name: str
    lat: float | None = None
    lng: float | None = None
    google_place_id: str | None = None


class ReservationPayload(BaseModel):
    english_name: str
    contact_number: str
    tour_date: str
    tour_start_time: str
    tour_duration: float
    number_of_people: int
    departure: str
    destination: str
    desired_course: str
    service_type: Literal["tour", "transfer"] = "tour"
    season: Literal["winter", "summer", "all_season"] | None = None
    # 정규화/분석 (하위호환: 모두 선택)
    course_id: str | None = None
    is_custom: bool = False
    source_channel: Literal["web", "app"] = "web"
    selected_spots: list[RoutePointInput] | None = None


def _user_exists(user_id: str) -> bool:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE id = %s LIMIT 1", (user_id,))
            return cursor.fetchone() is not None
    finally:
        conn.close()


def _serialize_row(row: dict[str, Any]) -> dict[str, Any]:
    result = dict(row)
    for key in ("created_at", "updated_at"):
        value = result.get(key)
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result


def _with_change_window(row: dict[str, Any]) -> dict[str, Any]:
    """예약에 변경 가능 여부를 붙여 준다.

    프론트가 날짜 계산을 다시 구현하면 서버 판정과 어긋나므로,
    화면은 이 값만 보고 버튼을 열고 닫는다.
    """
    row["change_window"] = describe_window(row.get("tour_date"))
    return row


def _find_reservation(user_id: str, reservation_number: str):
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT reservation_number, status, payment_status,
                       tour_date, tour_start_time, service_type
                FROM reservations
                WHERE user_id = %s AND reservation_number = %s
                LIMIT 1
                """,
                (user_id, reservation_number),
            )
            return cursor.fetchone()
    finally:
        conn.close()


@router.post("")
async def create_reservation(
    payload: ReservationPayload,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    if not _user_exists(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    if payload.service_type == "transfer" and payload.season is not None:
        raise HTTPException(status_code=400, detail="송영서비스는 season 값을 받을 수 없습니다")

    reservation_number = str(uuid.uuid4())
    record = {
        "pk": user_id,
        "englishName": payload.english_name,
        "phoneNumber": payload.contact_number,
        "tourDate": payload.tour_date,
        "tourStartTime": payload.tour_start_time,
        "tourDuration": payload.tour_duration,
        "numberOfPeople": payload.number_of_people,
        "departure": payload.departure,
        "destination": payload.destination,
        "tourCourse": payload.desired_course,
        "reservationNumber": reservation_number,
        "status": "pending",
        "serviceType": payload.service_type,
        "season": payload.season,
        "courseId": payload.course_id,
        "isCustom": payload.is_custom,
        "sourceChannel": payload.source_channel,
        "selectedSpots": [spot.model_dump() for spot in (payload.selected_spots or [])],
    }
    save_reservation_mysql(record)
    return {"message": "Reservation successful", "reservationNumber": reservation_number}


@router.get("")
async def list_reservations(
    reservation_number: str | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    if not _user_exists(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            if reservation_number:
                cursor.execute(
                    """
                    SELECT reservation_number, status, english_name, contact_number,
                           tour_date, tour_start_time, tour_duration_hours, number_of_people,
                           departure, destination, desired_course,
                           service_type, season,
                           payment_status, payment_amount_krw, payment_updated_at,
                           created_at, updated_at
                    FROM reservations
                    WHERE user_id = %s AND reservation_number = %s
                    LIMIT 1
                    """,
                    (user_id, reservation_number),
                )
                reservation = cursor.fetchone()
                if not reservation:
                    raise HTTPException(status_code=404, detail="Reservation not found")
                return {"reservations": [_with_change_window(_serialize_row(reservation))]}

            cursor.execute(
                """
                SELECT reservation_number, status, english_name, contact_number,
                       tour_date, tour_start_time, tour_duration_hours, number_of_people,
                       departure, destination, desired_course,
                       service_type, season,
                       payment_status, payment_amount_krw, payment_updated_at,
                       created_at, updated_at
                FROM reservations
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (user_id,),
            )
            rows = cursor.fetchall()
            return {"reservations": [_with_change_window(_serialize_row(row)) for row in rows]}
    finally:
        conn.close()


@router.patch("/{reservation_number}/cancel")
async def request_cancel_reservation(
    reservation_number: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    if not _user_exists(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    reservation = _find_reservation(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    current_status = reservation.get("status")
    if current_status in {"cancelled", "rejected", "completed"}:
        raise HTTPException(status_code=400, detail="현재 상태에서는 취소 요청을 진행할 수 없습니다")

    # 결제된 예약이면 환불을 먼저 처리한다. 환불이 실패하면 취소를 진행하지 않는다.
    # (상태만 취소로 바뀌고 돈은 남아 있는 상황을 만들지 않기 위함)
    refund_result: dict[str, Any] = {"refunded": False, "reason": "no_paid_order", "amount": 0}
    if reservation.get("payment_status") == "paid":
        try:
            refund_result = await refund_for_cancellation(
                user_id=user_id,
                reservation_number=reservation_number,
                reservation=reservation,
            )
        except RuntimeError as error:
            raise HTTPException(
                status_code=502,
                detail=f"환불 처리에 실패하여 취소를 완료하지 못했습니다. 고객센터로 문의해 주세요. ({error})",
            ) from error

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE reservations
                SET status = %s
                WHERE user_id = %s AND reservation_number = %s
                """,
                ("cancelled", user_id, reservation_number),
            )
            record_status_change(
                cursor,
                reservation_number,
                current_status,
                "cancelled",
                changed_by=user_id,
                reason=f"user_cancel/{refund_result.get('reason')}",
            )
        conn.commit()
    finally:
        conn.close()

    return {
        "message": "취소 요청이 접수되었습니다",
        "reservationNumber": reservation_number,
        "status": "cancelled",
        "refund": refund_result,
    }


@router.post("/{reservation_number}/change-requests")
async def request_reservation_change(
    reservation_number: str,
    payload: ChangeRequestPayload,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """예약 변경을 신청한다.

    즉시 반영하지 않는다. 약관상 변경은 "신청"이며, 배차 확인 후
    운영자가 처리한다. 요청은 reservation_change_requests 에 쌓인다.
    """
    user_id = str(current_user.get("user_id") or "").strip()
    if not _user_exists(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    reservation = _find_reservation(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if has_pending_request(reservation_number):
        raise HTTPException(
            status_code=409,
            detail="이미 처리 대기 중인 변경 요청이 있습니다. 처리 후 다시 신청해 주세요.",
        )

    try:
        normalized = validate_change_request(
            reservation,
            payload.tour_date,
            payload.tour_start_time,
        )
    except ChangeRequestError as error:
        # 기한이 지난 경우와 상태 문제는 409, 입력 오류는 400 으로 구분한다.
        status_code = 409 if error.code in {"inactive", "not_changeable", "date_window_closed", "time_window_closed"} else 400
        raise HTTPException(status_code=status_code, detail=error.message) from error

    request_id = create_change_request(
        reservation_number=reservation_number,
        user_id=user_id,
        normalized=normalized,
        reason=payload.reason,
    )

    return {
        "message": "변경 요청이 접수되었습니다. 확인 후 안내드리겠습니다.",
        "requestId": request_id,
        "reservationNumber": reservation_number,
        "requestType": normalized["request_type"],
    }


@router.get("/{reservation_number}/change-requests")
async def get_reservation_change_requests(
    reservation_number: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """이 예약에 대해 내가 넣은 변경 요청 목록."""
    user_id = str(current_user.get("user_id") or "").strip()
    reservation = _find_reservation(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    return {"requests": list_change_requests(user_id, reservation_number)}

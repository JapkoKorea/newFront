import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dependencies.auth import get_current_user
from services.mysql_reservation_service import (
    record_status_change,
    save_reservation_mysql,
)
from services.refund_service import refund_for_cancellation
from services.mysql_user_service import _connect


router = APIRouter(prefix="/api/reservations", tags=["reservations"])


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
                return {"reservations": [_serialize_row(reservation)]}

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
            return {"reservations": [_serialize_row(row) for row in rows]}
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

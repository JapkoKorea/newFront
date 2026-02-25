import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.mysql_reservation_service import save_reservation_mysql
from services.mysql_user_service import _connect


router = APIRouter(prefix="/api/reservations", tags=["reservations"])


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


def _user_exists(user_id: str) -> bool:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE id = %s LIMIT 1", (user_id,))
            return cursor.fetchone() is not None
    finally:
        conn.close()


def _serialize_row(row: dict) -> dict:
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
                SELECT reservation_number, status
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
async def create_reservation(payload: ReservationPayload, user_id: str):
    if not _user_exists(user_id):
        raise HTTPException(status_code=404, detail="User not found")

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
    }
    save_reservation_mysql(record)
    return {"message": "Reservation successful", "reservationNumber": reservation_number}


@router.get("")
async def list_reservations(user_id: str, reservation_number: str | None = None):
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
                           departure, destination, desired_course, created_at, updated_at
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
                       departure, destination, desired_course, created_at, updated_at
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
async def request_cancel_reservation(reservation_number: str, user_id: str):
    if not _user_exists(user_id):
        raise HTTPException(status_code=404, detail="User not found")

    reservation = _find_reservation(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    current_status = reservation.get("status")
    if current_status in {"cancelled", "rejected", "completed"}:
        raise HTTPException(status_code=400, detail="현재 상태에서는 취소 요청을 진행할 수 없습니다")

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
        conn.commit()
    finally:
        conn.close()

    return {
        "message": "취소 요청이 접수되었습니다",
        "reservationNumber": reservation_number,
        "status": "cancelled",
    }

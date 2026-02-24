import uuid

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

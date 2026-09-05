"""운영자용 예약 처리 — 상태 전이와 목록 조회.

예약 상태는 다음 다섯 가지다.

    pending    접수 완료. 고객이 예약을 넣은 직후.
    confirmed  확정. 배차를 확인한 뒤 운영자가 바꾼다.
    rejected   반려. 배차가 불가능한 경우.
    cancelled  취소. 고객 취소가 기본 경로이며 운영자도 취소할 수 있다.
    completed  이용 완료. 투어가 끝난 예약.

결제는 상태를 바꾸지 않는다. 결제 승인은 payment_status 만 다루고,
확정 여부는 배차 확인 결과이므로 운영자가 정한다.
"""

from datetime import date, datetime, time, timedelta
from typing import Any

from services.mysql_reservation_service import record_status_change
from services.mysql_user_service import _connect


# 허용되는 상태 전이. 여기 없는 조합은 거부한다.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"confirmed", "rejected", "cancelled"},
    "confirmed": {"completed", "cancelled"},
    # 아래 셋은 종결 상태다. 되돌리려면 DB 에서 직접 손대야 한다.
    "rejected": set(),
    "cancelled": set(),
    "completed": set(),
}

STATUS_LABELS = {
    "pending": "접수 완료",
    "confirmed": "확정",
    "rejected": "반려",
    "cancelled": "취소",
    "completed": "이용 완료",
}


class ReservationAdminError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    for key in ("created_at", "updated_at", "payment_updated_at"):
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = value.isoformat()

    value = out.get("tour_start_time")
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        out["tour_start_time"] = f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
    elif isinstance(value, time):
        out["tour_start_time"] = value.strftime("%H:%M")

    value = out.get("tour_date")
    if isinstance(value, datetime):
        out["tour_date"] = value.date().isoformat()
    elif isinstance(value, date):
        out["tour_date"] = value.isoformat()

    return out


def list_reservations_for_admin(
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """운영자용 예약 목록. 처리해야 할 것(pending)이 먼저 나온다."""
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            sql = """
                SELECT r.reservation_number, r.user_id, r.status, r.payment_status,
                       r.service_type, r.season, r.english_name, r.contact_number,
                       r.tour_date, r.tour_start_time, r.tour_duration_hours,
                       r.number_of_people, r.departure, r.destination, r.desired_course,
                       r.created_at, r.updated_at,
                       u.display_name AS user_display_name,
                       (SELECT COUNT(*) FROM reservation_change_requests cr
                         WHERE cr.reservation_number = r.reservation_number
                           AND cr.status = 'pending') AS pending_change_requests
                FROM reservations r
                JOIN users u ON u.id = r.user_id
            """
            params: list[Any] = []
            if status:
                sql += " WHERE r.status = %s"
                params.append(status)
            sql += " ORDER BY (r.status = 'pending') DESC, r.tour_date ASC, r.created_at DESC LIMIT %s"
            params.append(int(limit))

            cursor.execute(sql, tuple(params))
            return [_serialize(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_reservation_for_admin(reservation_number: str) -> dict[str, Any] | None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT r.*, u.display_name AS user_display_name
                FROM reservations r
                JOIN users u ON u.id = r.user_id
                WHERE r.reservation_number = %s
                LIMIT 1
                """,
                (reservation_number,),
            )
            row = cursor.fetchone()
            return _serialize(row) if row else None
    finally:
        conn.close()


def change_reservation_status(
    reservation_number: str,
    new_status: str,
    admin_user_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """예약 상태를 바꾸고 이력을 남긴다.

    조회와 갱신 사이에 다른 요청이 끼어들지 않도록 행을 잠그고 한
    트랜잭션에서 처리한다.
    """
    if new_status not in STATUS_LABELS:
        raise ReservationAdminError("invalid_status", "알 수 없는 상태입니다.")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT reservation_number, status FROM reservations WHERE reservation_number = %s FOR UPDATE",
                (reservation_number,),
            )
            row = cursor.fetchone()
            if not row:
                raise ReservationAdminError("not_found", "예약을 찾을 수 없습니다.")

            current = row["status"]
            if current == new_status:
                raise ReservationAdminError(
                    "no_change",
                    f"이미 {STATUS_LABELS.get(current, current)} 상태입니다.",
                )

            allowed = ALLOWED_TRANSITIONS.get(current, set())
            if new_status not in allowed:
                raise ReservationAdminError(
                    "invalid_transition",
                    f"{STATUS_LABELS.get(current, current)} 상태에서는 "
                    f"{STATUS_LABELS.get(new_status, new_status)}(으)로 바꿀 수 없습니다.",
                )

            cursor.execute(
                "UPDATE reservations SET status = %s WHERE reservation_number = %s",
                (new_status, reservation_number),
            )
            record_status_change(
                cursor,
                reservation_number,
                current,
                new_status,
                changed_by=admin_user_id,
                reason=(reason or "").strip() or "admin_status_change",
            )
        conn.commit()
        return {
            "reservationNumber": reservation_number,
            "from": current,
            "to": new_status,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

"""예약 변경 요청 — 약관 기준 판정과 저장.

상품 이용 규칙(src/products/common.js POLICIES)을 그대로 옮긴 규칙이다.

  - 투어 일자 5일 전까지 날짜를 변경할 수 있다.
  - 투어 일자 1일 전까지 이용 시간 변경을 신청할 수 있다.
  - 투어 당일에는 예약이 비활성화되어 변경 요청을 받지 않는다.

판정 기준 시각은 투어 운행지(홋카이도)의 현지 날짜다. 고객이 어디서 접속하든
"투어 며칠 전인가"는 현지 날짜로 세어야 운영 기준과 어긋나지 않는다.

변경은 즉시 반영되지 않는다. 약관도 "신청할 수 있습니다"라고만 한다.
요청을 쌓아두고 운영자가 배차를 확인한 뒤 처리한다.
"""

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from services.mysql_user_service import _connect


LOCAL_TZ = ZoneInfo("Asia/Tokyo")

# 약관 기준일. 값을 바꾸면 src/products/common.js 의 POLICIES 도 함께 고쳐야 한다.
DATE_CHANGE_MIN_DAYS = 5
TIME_CHANGE_MIN_DAYS = 1

# 변경 요청을 받을 수 있는 예약 상태. 취소/거절/완료된 예약은 대상이 아니다.
CHANGEABLE_STATUSES = {"pending", "confirmed"}

REASON_MAX_LENGTH = 1000


class ChangeRequestError(Exception):
    """규칙 위반. code 로 호출 측이 상태코드를 정한다."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


def _as_time(value: Any) -> time | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        return time(hour=total // 3600, minute=(total % 3600) // 60)
    text = str(value)
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            continue
    return None


def days_until_tour(tour_date: Any, today: date | None = None) -> int | None:
    """투어까지 남은 일수. 당일이면 0, 지났으면 음수."""
    target = _as_date(tour_date)
    if target is None:
        return None
    return (target - (today or today_local())).days


def describe_window(tour_date: Any, today: date | None = None) -> dict[str, Any]:
    """이 예약이 지금 무엇을 바꿀 수 있는지 요약한다.

    화면에서 버튼을 열고 닫는 데 쓰라고 만든 것이다. 프론트가 같은 날짜 계산을
    다시 구현하면 서버와 어긋나므로, 판정은 서버 한 곳에서만 한다.
    """
    remaining = days_until_tour(tour_date, today)
    if remaining is None:
        return {
            "daysUntilTour": None,
            "canChangeDate": False,
            "canChangeTime": False,
            "isActive": False,
            "notice": "투어 일자를 확인할 수 없습니다.",
        }

    if remaining <= 0:
        return {
            "daysUntilTour": remaining,
            "canChangeDate": False,
            "canChangeTime": False,
            "isActive": False,
            "notice": "투어 당일 이후에는 예약을 변경할 수 없습니다. 상담으로 문의해 주세요.",
        }

    can_date = remaining >= DATE_CHANGE_MIN_DAYS
    can_time = remaining >= TIME_CHANGE_MIN_DAYS

    if can_date:
        notice = f"투어까지 {remaining}일 남았습니다. 날짜와 시간 모두 변경 요청할 수 있습니다."
    elif can_time:
        notice = (
            f"투어까지 {remaining}일 남아 날짜 변경 기한(5일 전)은 지났습니다. "
            "시간 변경만 요청할 수 있습니다."
        )
    else:
        notice = "변경 요청 기한이 지났습니다."

    return {
        "daysUntilTour": remaining,
        "canChangeDate": can_date,
        "canChangeTime": can_time,
        "isActive": True,
        "notice": notice,
    }


def validate_change_request(
    reservation: dict[str, Any],
    requested_date: str | None,
    requested_time: str | None,
    today: date | None = None,
) -> dict[str, Any]:
    """약관 규칙으로 요청을 검증하고 정규화한다. 위반 시 ChangeRequestError."""
    today = today or today_local()

    status = str(reservation.get("status") or "")
    if status not in CHANGEABLE_STATUSES:
        raise ChangeRequestError(
            "not_changeable",
            "현재 상태에서는 변경 요청을 진행할 수 없습니다.",
        )

    current_date = _as_date(reservation.get("tour_date"))
    current_time = _as_time(reservation.get("tour_start_time"))
    if current_date is None or current_time is None:
        raise ChangeRequestError("invalid_reservation", "예약 일정 정보가 올바르지 않습니다.")

    window = describe_window(current_date, today)
    if not window["isActive"]:
        raise ChangeRequestError("inactive", window["notice"])

    new_date = _as_date(requested_date) if requested_date else None
    new_time = _as_time(requested_time) if requested_time else None

    if requested_date and new_date is None:
        raise ChangeRequestError("invalid_date", "변경 희망 날짜 형식이 올바르지 않습니다.")
    if requested_time and new_time is None:
        raise ChangeRequestError("invalid_time", "변경 희망 시간 형식이 올바르지 않습니다.")

    if new_date == current_date:
        new_date = None
    if new_time == current_time:
        new_time = None

    if new_date is None and new_time is None:
        raise ChangeRequestError(
            "no_change",
            "변경할 날짜나 시간을 하나 이상 입력해 주세요.",
        )

    if new_date is not None:
        if not window["canChangeDate"]:
            raise ChangeRequestError(
                "date_window_closed",
                f"날짜 변경은 투어 {DATE_CHANGE_MIN_DAYS}일 전까지만 신청할 수 있습니다.",
            )
        if new_date <= today:
            raise ChangeRequestError("past_date", "지난 날짜로는 변경할 수 없습니다.")
        # 새 날짜도 배차 준비가 필요하므로 같은 기준을 적용한다.
        if (new_date - today).days < DATE_CHANGE_MIN_DAYS:
            raise ChangeRequestError(
                "date_too_soon",
                f"변경 희망일은 오늘로부터 {DATE_CHANGE_MIN_DAYS}일 이후로 선택해 주세요.",
            )

    if new_time is not None and not window["canChangeTime"]:
        raise ChangeRequestError(
            "time_window_closed",
            f"시간 변경은 투어 {TIME_CHANGE_MIN_DAYS}일 전까지만 신청할 수 있습니다.",
        )

    if new_date is not None and new_time is not None:
        request_type = "both"
    elif new_date is not None:
        request_type = "date"
    else:
        request_type = "time"

    return {
        "request_type": request_type,
        "current_tour_date": current_date,
        "current_tour_start_time": current_time,
        "requested_tour_date": new_date,
        "requested_tour_start_time": new_time,
    }


def has_pending_request(reservation_number: str) -> bool:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM reservation_change_requests
                WHERE reservation_number = %s AND status = 'pending'
                LIMIT 1
                """,
                (reservation_number,),
            )
            return cursor.fetchone() is not None
    finally:
        conn.close()


def create_change_request(
    reservation_number: str,
    user_id: str,
    normalized: dict[str, Any],
    reason: str | None,
) -> int:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reservation_change_requests (
                    reservation_number, user_id, request_type,
                    current_tour_date, current_tour_start_time,
                    requested_tour_date, requested_tour_start_time,
                    reason, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                """,
                (
                    reservation_number,
                    user_id,
                    normalized["request_type"],
                    normalized["current_tour_date"],
                    normalized["current_tour_start_time"],
                    normalized["requested_tour_date"],
                    normalized["requested_tour_start_time"],
                    (reason or "").strip() or None,
                ),
            )
            request_id = cursor.lastrowid
        conn.commit()
        return request_id
    finally:
        conn.close()


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    for key in ("current_tour_date", "requested_tour_date"):
        value = out.get(key)
        if isinstance(value, date):
            out[key] = value.isoformat()
    for key in ("current_tour_start_time", "requested_tour_start_time"):
        value = _as_time(out.get(key))
        out[key] = value.strftime("%H:%M") if value else None
    for key in ("created_at", "updated_at", "resolved_at"):
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return out


def list_change_requests(user_id: str, reservation_number: str | None = None) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            if reservation_number:
                cursor.execute(
                    """
                    SELECT * FROM reservation_change_requests
                    WHERE user_id = %s AND reservation_number = %s
                    ORDER BY created_at DESC
                    """,
                    (user_id, reservation_number),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM reservation_change_requests
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    """,
                    (user_id,),
                )
            return [_serialize(row) for row in cursor.fetchall()]
    finally:
        conn.close()

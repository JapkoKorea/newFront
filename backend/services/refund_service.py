"""취소에 따른 환불 금액 산정과 토스페이먼츠 결제 취소 처리.

기준은 상품 이용 규칙(src/products/common.js POLICIES)이다.

  - 투어 일자 5일 전까지 취소하면 예약 수수료를 전액 환불한다.
  - 투어 일자 5일 이내에는 환불하지 않는다.
  - 투어 당일 취소와 노쇼는 별도로 택시 이용요금이 청구된다(현지 정산, 여기서 다루지 않는다).

예약 변경 기한(RESERVATION_CHANGE_PLAN.md)과 같은 5일 기준을 쓴다.
정책을 바꾸면 src/app/refund/page.jsx, src/components/FAQ.jsx,
src/products/common.js 를 함께 고쳐야 한다.
"""

import base64
import json
import os
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from services.mysql_user_service import _connect


TOSS_CANCEL_URL = "https://api.tosspayments.com/v1/payments/{payment_key}/cancel"

# 투어 운행지(홋카이도) 기준 시각으로 취소 시점을 판정한다.
LOCAL_TZ = ZoneInfo("Asia/Tokyo")

# 약관 기준일. 변경 요청 기한(change_request_service.DATE_CHANGE_MIN_DAYS)과 같다.
FULL_REFUND_DAYS = 5


def _tour_datetime(reservation: dict[str, Any]) -> datetime | None:
    """예약의 투어 시작 일시를 현지 시각 기준 datetime 으로 만든다."""
    tour_date = reservation.get("tour_date")
    tour_time = reservation.get("tour_start_time")
    if tour_date is None:
        return None

    if isinstance(tour_date, datetime):
        base = tour_date
    elif isinstance(tour_date, str):
        # 직렬화된 예약(문자열 날짜)이 넘어와도 동작해야 한다. 돈이 걸린 경로다.
        try:
            base = datetime.strptime(tour_date[:10], "%Y-%m-%d")
        except ValueError:
            return None
    else:
        base = datetime.combine(tour_date, datetime.min.time())

    if isinstance(tour_time, timedelta):
        base = base + tour_time
    elif isinstance(tour_time, str) and ":" in tour_time:
        hour, _, minute = tour_time.partition(":")
        try:
            base = base.replace(hour=int(hour), minute=int(minute[:2]))
        except ValueError:
            pass
    elif tour_time is not None and hasattr(tour_time, "hour"):
        base = base.replace(hour=tour_time.hour, minute=tour_time.minute)

    return base.replace(tzinfo=LOCAL_TZ)


def calculate_refund_krw(
    reservation: dict[str, Any],
    paid_amount: int,
    now: datetime | None = None,
) -> tuple[int, str]:
    """환불 금액과 산정 사유를 돌려준다.

    상태별로 판정이 다르다. "확정이 아니면 전액"으로 뭉뚱그리면 이미 이용을
    마친 예약(completed)까지 전액 환불로 떨어진다.

    - pending   확정 전이라 배차가 잡히지 않았다. 전액 환불.
    - confirmed 날짜 기준을 적용한다. 5일 전까지 전액, 그 뒤로는 환불 없음.
    - rejected  배차 불가로 예약이 성립하지 않았다. 전액 환불(이용약관 제7조).
    - completed 이미 이용을 마쳤다. 환불 없음.
    - cancelled 이미 취소돼 환불이 처리된 건이다. 중복 환불하지 않는다.
    """
    if paid_amount <= 0:
        return 0, "no_payment"

    status = str(reservation.get("status") or "")

    if status == "pending":
        return paid_amount, "not_confirmed_full_refund"
    if status == "rejected":
        return paid_amount, "rejected_full_refund"
    if status == "completed":
        return 0, "completed_no_refund"
    if status == "cancelled":
        return 0, "already_cancelled"
    if status != "confirmed":
        # 알 수 없는 상태는 자동 환불하지 않는다. 사람이 확인해야 한다.
        return 0, f"unknown_status/{status}"

    tour_at = _tour_datetime(reservation)
    if tour_at is None:
        return paid_amount, "unknown_tour_date_full_refund"

    current = now or datetime.now(LOCAL_TZ)
    # 남은 일수는 날짜(자정) 기준으로 센다. 변경 요청 판정과 같은 방식이다.
    days_left = (tour_at.date() - current.date()).days

    if days_left >= FULL_REFUND_DAYS:
        return paid_amount, "before_5days_full_refund"
    if days_left <= 0:
        return 0, "same_day_no_refund"
    return 0, "within_5days_no_refund"


def _find_paid_order(user_id: str, reservation_number: str) -> dict[str, Any] | None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT order_id, payment_key, amount_krw, status
                FROM reservation_payments
                WHERE user_id = %s AND reservation_number = %s AND status = 'paid'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id, reservation_number),
            )
            return cursor.fetchone()
    finally:
        conn.close()


def _mark_refunded(order_id: str, refund_amount: int, response_body: dict[str, Any]) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            status = "refunded" if refund_amount > 0 else "cancelled_no_refund"
            cursor.execute(
                """
                UPDATE reservation_payments
                SET status = %s,
                    raw_response_json = %s,
                    updated_at = UTC_TIMESTAMP(6)
                WHERE order_id = %s
                """,
                (status, json.dumps(response_body, ensure_ascii=False), order_id),
            )
            cursor.execute(
                """
                UPDATE reservations r
                JOIN reservation_payments p ON p.reservation_number = r.reservation_number
                SET r.payment_status = %s,
                    r.payment_updated_at = UTC_TIMESTAMP(6)
                WHERE p.order_id = %s
                """,
                (status, order_id),
            )
        conn.commit()
    finally:
        conn.close()


async def refund_for_cancellation(
    user_id: str,
    reservation_number: str,
    reservation: dict[str, Any],
) -> dict[str, Any]:
    """취소 시 환불을 처리한다.

    결제 이력이 없으면 아무것도 하지 않는다. 토스 호출이 실패하면
    예외를 올려 취소 자체를 롤백할 수 있게 한다.
    """
    order = _find_paid_order(user_id, reservation_number)
    if not order:
        return {"refunded": False, "reason": "no_paid_order", "amount": 0}

    paid_amount = int(order.get("amount_krw") or 0)
    refund_amount, reason = calculate_refund_krw(reservation, paid_amount)

    if refund_amount <= 0:
        _mark_refunded(order["order_id"], 0, {"reason": reason})
        return {"refunded": False, "reason": reason, "amount": 0}

    secret_key = os.getenv("TOSS_SECRET_KEY", "").strip()
    if not secret_key:
        raise RuntimeError("TOSS_SECRET_KEY is not configured")

    auth_token = base64.b64encode(f"{secret_key}:".encode("utf-8")).decode("utf-8")
    body: dict[str, Any] = {"cancelReason": "고객 예약 취소"}
    if refund_amount < paid_amount:
        body["cancelAmount"] = refund_amount

    url = TOSS_CANCEL_URL.format(payment_key=order["payment_key"])
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Basic {auth_token}",
                "Content-Type": "application/json",
            },
            json=body,
        )

    if response.status_code != 200:
        detail = response.text
        raise RuntimeError(f"토스 결제 취소 실패: HTTP {response.status_code} {detail}")

    payload = response.json()
    _mark_refunded(order["order_id"], refund_amount, payload)
    return {
        "refunded": True,
        "reason": reason,
        "amount": refund_amount,
        "paidAmount": paid_amount,
    }

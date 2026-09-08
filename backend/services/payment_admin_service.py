"""운영자의 입금 확인.

토스 결제를 잠시 내리고 계좌이체를 받는 동안, 입금 여부는 사람이 통장을 보고
판단한다. 고객이 "입금했다"고 알리면 결제 대기(ready)가 되고, 운영자가 확인해
결제 완료(paid)로 바꾸거나 결제 전(unpaid)으로 되돌린다.

예약 상태(pending/confirmed/cancelled)는 여기서 건드리지 않는다. 결제와 예약은
서로 연결하지 않는다는 규칙을 그대로 따른다 — 입금이 확인돼도 예약 확정은
운영자가 따로 판단한다.
"""

from datetime import datetime
from typing import Any

from services.mysql_user_service import _connect


PAYMENT_STATUSES = {"unpaid", "ready", "paid", "failed", "refunded"}

# 운영자가 손으로 바꿀 수 있는 값. 환불·실패는 결제 연동이 살아난 뒤에 다룬다.
ADMIN_SETTABLE = {"paid", "unpaid"}


class PaymentAdminError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def set_payment_status(reservation_number: str, status: str) -> dict[str, Any]:
    if status not in ADMIN_SETTABLE:
        raise PaymentAdminError("invalid_status", f"바꿀 수 없는 결제 상태입니다: {status}")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT reservation_number, payment_status FROM reservations WHERE reservation_number = %s LIMIT 1",
                (reservation_number,),
            )
            row = cursor.fetchone()
            if not row:
                raise PaymentAdminError("not_found", "예약을 찾을 수 없습니다")

            cursor.execute(
                """
                UPDATE reservations
                SET payment_status = %s, payment_updated_at = %s
                WHERE reservation_number = %s
                """,
                (status, datetime.now(), reservation_number),
            )
        conn.commit()
    finally:
        conn.close()

    return {
        "reservationNumber": reservation_number,
        "previousPaymentStatus": row.get("payment_status"),
        "paymentStatus": status,
    }

"""사람이 확인하는 결제(계좌이체·스마트스토어).

카드 결제는 PG 가 승인 결과를 돌려주지만, 계좌이체와 스마트스토어 결제는
"고객이 냈다고 말한 것"과 "운영자가 통장·스토어에서 확인한 것"이 나뉜다.
그 두 단계를 결제 원장(reservation_payments)에 남긴다.

  1. 고객 선언  -> 원장에 ready 행 생성 + reservations.payment_status='ready'
  2. 운영자 확인 -> 원장 paid + approved_at + confirmed_by, reservations 도 paid

예약 상태(pending/confirmed)는 여기서 바꾸지 않는다. 운영자 화면이 결제 확인과
예약 확정을 한 번에 할 수 있게 해 주더라도, 그 둘은 서로 다른 판단이다.
"""

import uuid
from datetime import datetime
from typing import Any

from services.mysql_user_service import _connect


# 고객이 고를 수 있는 결제 경로.
CHANNELS = {
    "bank_transfer": "계좌이체",
    "naver": "스마트스토어",
}

DECLARED_STATUS = "ready"
CONFIRMED_STATUS = "paid"


class ManualPaymentError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def channel_label(channel: str | None) -> str:
    return CHANNELS.get(channel or "", "확인 필요")


def declare(
    user_id: str,
    reservation_number: str,
    amount: int,
    channel: str,
    external_order_no: str | None = None,
) -> dict[str, Any]:
    """고객이 결제했다고 알린다. 확인은 운영자가 한다.

    이미 결제 완료된 예약은 건드리지 않는다 — 고객의 선언이 확인된 결제를
    되돌리면 안 된다.

    같은 예약에 여러 번 선언할 수 있다(계좌이체로 눌렀다가 스마트스토어로
    바꾸는 경우). 대기 중인 선언이 있으면 새로 만들지 않고 갱신한다.
    """
    if channel not in CHANNELS:
        raise ManualPaymentError("invalid_channel", f"알 수 없는 결제 수단입니다: {channel}")

    now = datetime.now()
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT payment_status FROM reservations
                WHERE user_id = %s AND reservation_number = %s
                FOR UPDATE
                """,
                (user_id, reservation_number),
            )
            row = cursor.fetchone()
            if not row:
                raise ManualPaymentError("not_found", "예약을 찾을 수 없습니다")
            if row.get("payment_status") == CONFIRMED_STATUS:
                conn.rollback()
                return {"paymentStatus": CONFIRMED_STATUS, "alreadyPaid": True}

            cursor.execute(
                """
                SELECT order_id FROM reservation_payments
                WHERE reservation_number = %s AND user_id = %s AND status = %s
                ORDER BY created_at DESC LIMIT 1
                """,
                (reservation_number, user_id, DECLARED_STATUS),
            )
            pending = cursor.fetchone()

            if pending:
                order_id = pending["order_id"]
                cursor.execute(
                    """
                    UPDATE reservation_payments
                    SET amount_krw = %s, channel = %s, method = %s,
                        external_order_no = %s, declared_at = %s
                    WHERE order_id = %s
                    """,
                    (amount, channel, channel_label(channel), external_order_no, now, order_id),
                )
            else:
                order_id = f"manual_{uuid.uuid4().hex[:20]}"
                cursor.execute(
                    """
                    INSERT INTO reservation_payments (
                        order_id, reservation_number, user_id, amount_krw, status,
                        channel, method, external_order_no, declared_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        order_id, reservation_number, user_id, amount, DECLARED_STATUS,
                        channel, channel_label(channel), external_order_no, now,
                    ),
                )

            cursor.execute(
                """
                UPDATE reservations
                SET payment_status = %s, payment_amount_krw = %s, payment_updated_at = %s
                WHERE user_id = %s AND reservation_number = %s AND payment_status <> %s
                """,
                (DECLARED_STATUS, amount, now, user_id, reservation_number, CONFIRMED_STATUS),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "paymentStatus": DECLARED_STATUS,
        "orderId": order_id,
        "amount": amount,
        "channel": channel,
        "alreadyPaid": False,
    }


def confirm(reservation_number: str, admin_user_id: str) -> dict[str, Any]:
    """운영자가 입금·결제를 확인한다. 원장과 예약 모두 결제 완료로 바꾼다."""
    now = datetime.now()
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT payment_status FROM reservations WHERE reservation_number = %s FOR UPDATE",
                (reservation_number,),
            )
            if not cursor.fetchone():
                raise ManualPaymentError("not_found", "예약을 찾을 수 없습니다")

            cursor.execute(
                """
                UPDATE reservation_payments
                SET status = %s, approved_at = %s, confirmed_by = %s
                WHERE reservation_number = %s AND status = %s
                """,
                (CONFIRMED_STATUS, now, admin_user_id, reservation_number, DECLARED_STATUS),
            )
            ledger_rows = cursor.rowcount

            cursor.execute(
                """
                UPDATE reservations
                SET payment_status = %s, payment_updated_at = %s
                WHERE reservation_number = %s
                """,
                (CONFIRMED_STATUS, now, reservation_number),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"paymentStatus": CONFIRMED_STATUS, "ledgerUpdated": ledger_rows}


def revert(reservation_number: str) -> dict[str, Any]:
    """확인을 되돌린다. 잘못 확인했을 때 쓴다.

    원장 행은 지우지 않고 다시 대기로 돌린다 — 기록은 남겨야 한다.
    """
    now = datetime.now()
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE reservation_payments
                SET status = %s, approved_at = NULL, confirmed_by = NULL
                WHERE reservation_number = %s AND status = %s
                """,
                (DECLARED_STATUS, reservation_number, CONFIRMED_STATUS),
            )
            cursor.execute(
                """
                UPDATE reservations
                SET payment_status = %s, payment_updated_at = %s
                WHERE reservation_number = %s
                """,
                ("unpaid", now, reservation_number),
            )
        conn.commit()
    finally:
        conn.close()
    return {"paymentStatus": "unpaid"}


def list_for_reservations(reservation_numbers: list[str]) -> dict[str, dict[str, Any]]:
    """예약별 최신 결제 기록. 운영자 목록에서 어디를 확인할지 보여준다."""
    if not reservation_numbers:
        return {}
    placeholders = ",".join(["%s"] * len(reservation_numbers))
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT p.reservation_number, p.order_id, p.amount_krw, p.status,
                       p.channel, p.external_order_no, p.declared_at, p.approved_at
                FROM reservation_payments p
                JOIN (
                    SELECT reservation_number, MAX(created_at) AS latest
                    FROM reservation_payments
                    WHERE reservation_number IN ({placeholders})
                    GROUP BY reservation_number
                ) last ON last.reservation_number = p.reservation_number
                      AND last.latest = p.created_at
                """,
                tuple(reservation_numbers),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        item = dict(row)
        for key in ("declared_at", "approved_at"):
            value = item.get(key)
            if isinstance(value, datetime):
                item[key] = value.isoformat()
        item["channelLabel"] = channel_label(item.get("channel"))
        out[item["reservation_number"]] = item
    return out

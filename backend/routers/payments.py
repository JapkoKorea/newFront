import base64
import json
import os
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies.auth import get_current_user
from services.manual_payment_service import (
    ManualPaymentError,
    declare as declare_manual_payment,
)
from services.mysql_user_service import _connect


router = APIRouter(prefix="/api/payments", tags=["payments"])


TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm"


class PaymentPrepareResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    customer_key: str
    customer_name: str
    customer_mobile_phone: str
    order_name: str
    client_key: str
    success_url: str
    fail_url: str


class PaymentConfirmPayload(BaseModel):
    paymentKey: str = Field(min_length=1)
    orderId: str = Field(min_length=6, max_length=64)
    amount: int = Field(gt=0)


class PaymentFailPayload(BaseModel):
    orderId: str = Field(min_length=6, max_length=64)
    code: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing environment variable: {name}")
    return value


def _serialize_row(row: dict[str, Any]) -> dict[str, Any]:
    result = dict(row)
    for key in ("approved_at", "created_at", "updated_at", "payment_updated_at"):
        value = result.get(key)
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result


def _format_time(value: Any) -> str | None:
    """MySQL TIME 은 timedelta 로 온다. HH:MM 문자열로 바꾼다."""
    if value is None:
        return None
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        return f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
    return str(value)[:5]


def _find_reservation_for_payment(user_id: str, reservation_number: str):
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT r.reservation_number, r.user_id, r.status, r.payment_status,
                       r.english_name, r.contact_number, r.tour_duration_hours, r.number_of_people,
                       r.departure, r.destination, r.tour_date, r.tour_start_time,
                       r.service_type, r.desired_course, r.deposit_krw, r.course_id,
                       c.deposit_krw AS course_deposit_krw
                FROM reservations r
                LEFT JOIN courses c ON c.id = r.course_id
                WHERE r.user_id = %s AND r.reservation_number = %s
                LIMIT 1
                """,
                (user_id, reservation_number),
            )
            return cursor.fetchone()
    finally:
        conn.close()


# 투어일까지 남은 일수가 이 값 이하이면 임박 예약으로 본다(당일 = 0, 하루 전 = 1).
LAST_MINUTE_DAYS = 1

# 투어 운행지 기준으로 남은 일수를 센다.
LOCAL_TZ = ZoneInfo("Asia/Tokyo")


def _is_last_minute(tour_date: Any) -> bool:
    """당일 또는 전일 예약인지 판정한다. 날짜를 알 수 없으면 False."""
    if tour_date is None:
        return False

    if isinstance(tour_date, datetime):
        target = tour_date.date()
    elif isinstance(tour_date, date):
        target = tour_date
    else:
        try:
            target = datetime.strptime(str(tour_date), "%Y-%m-%d").date()
        except ValueError:
            return False

    today = datetime.now(LOCAL_TZ).date()
    return (target - today).days <= LAST_MINUTE_DAYS


def _calculate_amount_krw(reservation: dict[str, Any]) -> int:
    service_type = reservation.get("service_type", "tour")

    if service_type == "transfer":
        amount = reservation.get("deposit_krw")
        if not amount:
            raise HTTPException(
                status_code=400,
                detail="아직 견적이 확정되지 않은 송영 예약입니다. 기사님의 견적 안내를 기다려 주세요.",
            )
        return int(amount)

    # 투어 상품: 예약 시점 결제 금액은 "예약금"이다(PRICING_DEPOSIT_POLICY.md 1.1).
    # 실제 택시 요금(JPY)은 현지에서 정산하며 결제 금액에 포함하지 않는다.
    # 코스별 예약금이 지정돼 있으면 그 값을, 없으면 기본 예약금을 사용한다.
    duration = float(reservation.get("tour_duration_hours") or 0)
    people = int(reservation.get("number_of_people") or 0)

    if duration <= 0 or people <= 0:
        raise HTTPException(status_code=400, detail="결제 금액 계산에 필요한 예약 정보가 올바르지 않습니다")

    default_deposit = int(os.getenv("BASE_DEPOSIT_KRW", "15000"))
    amount = int(reservation.get("course_deposit_krw") or default_deposit)

    # 당일 또는 전일 예약은 배차 조율 부담이 커서 예약금이 올라간다.
    # 프론트의 src/lib/pricing.js 와 동일한 기준을 유지해야 한다.
    if _is_last_minute(reservation.get("tour_date")):
        amount = max(amount, int(os.getenv("LAST_MINUTE_DEPOSIT_KRW", "20000")))

    if amount <= 0:
        raise HTTPException(status_code=400, detail="결제 금액이 유효하지 않습니다")

    return amount


def _create_or_replace_payment_order(user_id: str, reservation_number: str, amount: int) -> str:
    order_id = f"pay_{uuid.uuid4().hex[:24]}"
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reservation_payments (
                    order_id, reservation_number, user_id, amount_krw, status
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (order_id, reservation_number, user_id, amount, "ready"),
            )
            cursor.execute(
                """
                UPDATE reservations
                SET payment_amount_krw = %s,
                    payment_status = %s,
                    payment_updated_at = UTC_TIMESTAMP(6)
                WHERE reservation_number = %s AND user_id = %s
                """,
                (amount, "ready", reservation_number, user_id),
            )
        conn.commit()
        return order_id
    finally:
        conn.close()


def _find_latest_payment_order(user_id: str, reservation_number: str):
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT order_id, amount_krw, status
                FROM reservation_payments
                WHERE user_id = %s AND reservation_number = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id, reservation_number),
            )
            return cursor.fetchone()
    finally:
        conn.close()


def _mark_payment_failed(order_id: str, user_id: str, code: str, message: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE reservation_payments
                SET status = %s,
                    failure_code = %s,
                    failure_message = %s,
                    updated_at = UTC_TIMESTAMP(6)
                WHERE order_id = %s AND user_id = %s
                """,
                ("failed", code, message, order_id, user_id),
            )
            cursor.execute(
                """
                UPDATE reservations r
                JOIN reservation_payments p ON p.reservation_number = r.reservation_number
                SET r.payment_status = %s,
                    r.payment_updated_at = UTC_TIMESTAMP(6)
                WHERE p.order_id = %s AND p.user_id = %s AND r.user_id = %s
                """,
                ("failed", order_id, user_id, user_id),
            )
        conn.commit()
    finally:
        conn.close()


@router.post("/prepare", response_model=PaymentPrepareResponse)
async def prepare_payment(
    reservation_number: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    reservation = _find_reservation_for_payment(user_id=user_id, reservation_number=reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if reservation.get("status") in {"cancelled", "rejected"}:
        raise HTTPException(status_code=400, detail="해당 예약은 결제를 진행할 수 없는 상태입니다")
    if reservation.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="이미 결제가 완료된 예약입니다")

    # 키 검사를 주문 생성보다 먼저 한다. 뒤에 두면 키가 없을 때 예약만
    # 결제 대기로 바뀌고 응답은 500 이 되어, 결제하지 않은 예약이 대기로 남는다.
    client_key = _require_env("TOSS_CLIENT_KEY")

    amount = _calculate_amount_krw(reservation)
    latest_order = _find_latest_payment_order(user_id=user_id, reservation_number=reservation_number)
    if (
        latest_order
        and latest_order.get("status") == "ready"
        and int(latest_order.get("amount_krw") or 0) == amount
    ):
        order_id = latest_order.get("order_id")
    else:
        order_id = _create_or_replace_payment_order(
            user_id=user_id,
            reservation_number=reservation_number,
            amount=amount,
        )

    frontend_base_url = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")

    return PaymentPrepareResponse(
        order_id=order_id,
        amount=amount,
        currency="KRW",
        customer_key=user_id,
        customer_name=reservation.get("english_name") or "고객",
        customer_mobile_phone=(reservation.get("contact_number") or "").replace("-", ""),
        order_name=f"비에이 택시투어 예약금 ({reservation.get('tour_date')})",
        client_key=client_key,
        success_url=f"{frontend_base_url}/payments/success?reservation_number={reservation_number}",
        fail_url=f"{frontend_base_url}/payments/fail?reservation_number={reservation_number}",
    )


@router.post("/confirm")
async def confirm_payment(
    payload: PaymentConfirmPayload,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    secret_key = _require_env("TOSS_SECRET_KEY")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT order_id, reservation_number, amount_krw, status
                FROM reservation_payments
                WHERE order_id = %s AND user_id = %s
                LIMIT 1
                """,
                (payload.orderId, user_id),
            )
            order = cursor.fetchone()
    finally:
        conn.close()

    if not order:
        raise HTTPException(status_code=404, detail="결제 주문을 찾을 수 없습니다")

    expected_amount = int(order.get("amount_krw") or 0)
    if payload.amount != expected_amount:
        raise HTTPException(status_code=400, detail="결제 금액 검증에 실패했습니다")

    auth_token = base64.b64encode(f"{secret_key}:".encode("utf-8")).decode("utf-8")
    headers = {
        "Authorization": f"Basic {auth_token}",
        "Content-Type": "application/json",
    }

    request_body = {
        "paymentKey": payload.paymentKey,
        "orderId": payload.orderId,
        "amount": payload.amount,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(TOSS_CONFIRM_URL, headers=headers, json=request_body)

    if response.status_code != 200:
        error_body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        _mark_payment_failed(
            order_id=payload.orderId,
            user_id=user_id,
            code=error_body.get("code", "TOSS_CONFIRM_FAILED"),
            message=error_body.get("message", f"HTTP {response.status_code}"),
        )
        raise HTTPException(status_code=400, detail=error_body.get("message", "결제 승인에 실패했습니다"))

    payment_data = response.json()
    payment_method = payment_data.get("method")

    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE reservation_payments
                SET status = %s,
                    payment_key = %s,
                    method = %s,
                    raw_response_json = %s,
                    approved_at = UTC_TIMESTAMP(6),
                    updated_at = UTC_TIMESTAMP(6)
                WHERE order_id = %s AND user_id = %s
                """,
                (
                    "paid",
                    payload.paymentKey,
                    payment_method,
                    json.dumps(payment_data, ensure_ascii=False),
                    payload.orderId,
                    user_id,
                ),
            )
            cursor.execute(
                """
                UPDATE reservations r
                JOIN reservation_payments p ON p.reservation_number = r.reservation_number
                SET r.payment_status = %s,
                    r.payment_amount_krw = %s,
                    r.payment_updated_at = UTC_TIMESTAMP(6)
                WHERE p.order_id = %s AND p.user_id = %s AND r.user_id = %s
                """,
                ("paid", payload.amount, payload.orderId, user_id, user_id),
            )

            # 결제와 예약 상태(status)는 분리해 둔다.
            # 결제 승인은 payment_status 만 바꾸고, 예약 확정(confirmed)은
            # 배차 확인 후 운영자가 별도로 처리한다.
        conn.commit()
    finally:
        conn.close()

    return {
        "ok": True,
        "payment": {
            "orderId": payload.orderId,
            "paymentKey": payload.paymentKey,
            "amount": payload.amount,
            "method": payment_method,
            "status": payment_data.get("status"),
        },
    }


@router.post("/fail")
async def mark_payment_fail(
    payload: PaymentFailPayload,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    _mark_payment_failed(
        order_id=payload.orderId,
        user_id=user_id,
        code=payload.code,
        message=payload.message,
    )
    return {"ok": True}


@router.get("/status")
async def payment_status(
    reservation_number: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    user_id = str(current_user.get("user_id") or "").strip()
    conn = _connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT order_id, reservation_number, user_id, amount_krw, status, payment_key,
                       method, failure_code, failure_message, approved_at, created_at, updated_at
                FROM reservation_payments
                WHERE user_id = %s AND reservation_number = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (user_id, reservation_number),
            )
            payment = cursor.fetchone()
    finally:
        conn.close()

    if not payment:
        return {"payment": None}
    return {"payment": _serialize_row(payment)}


# ── 계좌이체 (토스 결제 비활성 기간) ─────────────────────────────

# 입금은 사람이 확인한다. 고객이 "입금했다"고 알리면 결제 대기(ready)로 두고,
# 운영자가 통장을 보고 결제 완료(paid)로 바꾼다. 예약 상태(pending/confirmed)는
# 여기서 건드리지 않는다 — 결제와 예약은 별도로 관리한다.
TRANSFER_DECLARED_STATUS = "ready"

# 이 상태에서는 더 받을 돈이 없다. 계좌를 보여주면 고객이 송금한 뒤에야
# 안 되는 예약임을 알게 된다.
NON_PAYABLE_STATUSES = {"cancelled", "rejected", "completed"}

NON_PAYABLE_REASON = {
    "cancelled": "취소된 예약입니다. 입금하지 마시고 문의로 연락 주세요.",
    "rejected": "반려된 예약입니다. 입금하지 마시고 문의로 연락 주세요.",
    "completed": "이미 이용이 끝난 예약입니다. 결제 관련 문의는 상담으로 연락 주세요.",
}


@router.get("/transfer-info")
async def transfer_info(
    reservation_number: str,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """계좌이체 안내에 필요한 금액과 예약 요약.

    금액 계산은 카드 결제와 같은 함수를 쓴다. 전일·당일 예약이 20,000원이 되는
    규칙이 두 경로에서 어긋나면 안 된다.
    """
    user_id = str(current_user.get("user_id") or "").strip()
    reservation = _find_reservation_for_payment(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")

    amount = _calculate_amount_krw(reservation)
    tour_date = reservation.get("tour_date")
    start_time = reservation.get("tour_start_time")
    reservation_status = reservation.get("status")
    block_reason = NON_PAYABLE_REASON.get(reservation_status)

    return {
        "amount": amount,
        "isLastMinute": _is_last_minute(tour_date),
        "paymentStatus": reservation.get("payment_status") or "unpaid",
        "canPay": block_reason is None,
        "blockReason": block_reason,
        "reservation": {
            "reservationNumber": reservation.get("reservation_number"),
            "status": reservation.get("status"),
            "englishName": reservation.get("english_name"),
            "contactNumber": reservation.get("contact_number"),
            "tourDate": tour_date.isoformat() if hasattr(tour_date, "isoformat") else tour_date,
            "tourStartTime": _format_time(start_time),
            "durationHours": reservation.get("tour_duration_hours"),
            "numberOfPeople": reservation.get("number_of_people"),
            "departure": reservation.get("departure"),
            "destination": reservation.get("destination"),
            "desiredCourse": reservation.get("desired_course"),
        },
    }


class DeclarePaymentPayload(BaseModel):
    channel: Literal["bank_transfer", "naver"]
    # 스마트스토어 주문번호. 있으면 운영자가 스토어에서 바로 찾을 수 있다.
    external_order_no: str | None = Field(default=None, max_length=64)


@router.post("/declare")
async def declare_payment(
    reservation_number: str,
    payload: DeclarePaymentPayload,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """고객이 "결제했다"고 알린다. 확인은 운영자가 한다.

    이 선언만으로 결제 완료가 되지는 않는다. 통장이나 스토어 주문을 확인하기
    전까지는 결제 대기다. 예약 상태는 여기서 바뀌지 않는다.
    """
    user_id = str(current_user.get("user_id") or "").strip()
    reservation = _find_reservation_for_payment(user_id, reservation_number)
    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")

    block_reason = NON_PAYABLE_REASON.get(reservation.get("status"))
    if block_reason:
        raise HTTPException(status_code=400, detail=block_reason)

    amount = _calculate_amount_krw(reservation)
    try:
        result = declare_manual_payment(
            user_id=user_id,
            reservation_number=reservation_number,
            amount=amount,
            channel=payload.channel,
            external_order_no=(payload.external_order_no or "").strip() or None,
        )
    except ManualPaymentError as error:
        status_code = 404 if error.code == "not_found" else 400
        raise HTTPException(status_code=status_code, detail=error.message) from error

    if result.get("alreadyPaid"):
        return {"paymentStatus": "paid", "message": "이미 결제가 확인된 예약입니다."}

    return {
        **result,
        "message": "결제 확인 요청이 접수되었습니다. 확인 후 예약을 확정해 드리겠습니다.",
    }

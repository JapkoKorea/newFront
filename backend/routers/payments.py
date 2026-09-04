import base64
import json
import os
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies.auth import get_current_user
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

    client_key = _require_env("TOSS_CLIENT_KEY")
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

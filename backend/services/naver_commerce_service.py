"""네이버 커머스 API 로 스마트스토어 주문을 확인한다.

고객이 "스마트스토어에서 결제했다"며 남긴 주문번호가 실제 주문인지, 결제가
끝났는지, 금액이 맞는지를 판매자 API 로 대조한다. 사람이 스토어를 열어
확인하던 자리를 대신한다.

인증은 OAuth2 client_credentials 인데 서명 방식이 특이하다. client_secret 을
그대로 보내지 않고, client_secret 을 bcrypt 의 salt 로 써서
"{client_id}_{timestamp}" 를 해싱한 값을 base64 로 보낸다.
  https://apicenter.commerce.naver.com/ko/basic/commerce-api

주의: 응답 필드명은 계정 권한과 API 버전에 따라 다를 수 있다. 그래서 상태와
금액을 여러 후보 키에서 찾고, **확신이 서지 않으면 확인하지 않는다**.
자동 확인이 틀리는 것보다 사람이 한 번 더 보는 편이 낫다.
"""

import base64
import os
import time
from datetime import datetime, timedelta
from typing import Any

import bcrypt
import httpx


API_BASE = os.getenv("NAVER_COMMERCE_API_BASE", "https://api.commerce.naver.com/external")
TOKEN_PATH = "/v1/oauth2/token"
PRODUCT_ORDER_IDS_PATH = "/v1/pay-order/seller/orders/{order_id}/product-order-ids"
PRODUCT_ORDER_QUERY_PATH = "/v1/pay-order/seller/product-orders/query"

REQUEST_TIMEOUT = 10.0

# 결제가 끝났다고 볼 수 있는 상품주문 상태.
# PAYED = 결제 완료. 이후 단계(배송중 등)도 결제는 끝난 것이다.
PAID_STATUSES = {
    "PAYED",
    "DELIVERING",
    "DELIVERED",
    "PURCHASE_DECIDED",
    "EXCHANGED",
}

# 결제가 취소·환불된 상태. 확인해서는 안 된다.
VOID_STATUSES = {"CANCELED", "CANCELLED", "RETURNED", "REFUNDED"}


class NaverCommerceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def is_configured() -> bool:
    return bool(os.getenv("NAVER_COMMERCE_CLIENT_ID") and os.getenv("NAVER_COMMERCE_CLIENT_SECRET"))


# 토큰은 보통 3시간짜리다. 매번 발급받지 않도록 만료 전까지 들고 있는다.
_token_cache: dict[str, Any] = {"value": None, "expires_at": None}


def _signature(client_id: str, client_secret: str, timestamp_ms: int) -> str:
    """client_secret 을 salt 로 쓰는 bcrypt 서명."""
    password = f"{client_id}_{timestamp_ms}".encode("utf-8")
    hashed = bcrypt.hashpw(password, client_secret.encode("utf-8"))
    return base64.standard_b64encode(hashed).decode("utf-8")


def _issue_token() -> str:
    client_id = os.getenv("NAVER_COMMERCE_CLIENT_ID", "").strip()
    client_secret = os.getenv("NAVER_COMMERCE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise NaverCommerceError("not_configured", "네이버 커머스 API 키가 설정되지 않았습니다")

    cached = _token_cache.get("value")
    expires_at = _token_cache.get("expires_at")
    if cached and expires_at and datetime.now() < expires_at:
        return cached

    timestamp_ms = int(time.time() * 1000)
    payload = {
        "client_id": client_id,
        "timestamp": timestamp_ms,
        "client_secret_sign": _signature(client_id, client_secret, timestamp_ms),
        "grant_type": "client_credentials",
        "type": "SELF",
    }

    try:
        response = httpx.post(
            f"{API_BASE}{TOKEN_PATH}",
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=REQUEST_TIMEOUT,
        )
    except httpx.HTTPError as error:
        raise NaverCommerceError("network", f"네이버 API 에 연결하지 못했습니다: {error}") from error

    if response.status_code != 200:
        raise NaverCommerceError(
            "token_failed",
            f"토큰 발급 실패 ({response.status_code}): {response.text[:200]}",
        )

    body = response.json()
    token = body.get("access_token")
    if not token:
        raise NaverCommerceError("token_failed", "토큰 응답에 access_token 이 없습니다")

    # 만료 30초 전에 새로 받는다.
    expires_in = int(body.get("expires_in") or 3600)
    _token_cache["value"] = token
    _token_cache["expires_at"] = datetime.now() + timedelta(seconds=max(60, expires_in - 30))
    return token


def _request(method: str, path: str, **kwargs: Any) -> Any:
    token = _issue_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    try:
        response = httpx.request(
            method, f"{API_BASE}{path}", headers=headers, timeout=REQUEST_TIMEOUT, **kwargs
        )
    except httpx.HTTPError as error:
        raise NaverCommerceError("network", f"네이버 API 요청 실패: {error}") from error

    if response.status_code == 404:
        raise NaverCommerceError("not_found", "주문을 찾을 수 없습니다")
    if response.status_code != 200:
        raise NaverCommerceError(
            "api_error", f"네이버 API 오류 ({response.status_code}): {response.text[:200]}"
        )
    return response.json()


def _product_order_ids(order_id: str) -> list[str]:
    body = _request("GET", PRODUCT_ORDER_IDS_PATH.format(order_id=order_id))
    # 응답 모양이 계정에 따라 다를 수 있어 몇 가지 형태를 받아 준다.
    if isinstance(body, list):
        return [str(x) for x in body]
    if isinstance(body, dict):
        for key in ("data", "productOrderIds", "contents"):
            value = body.get(key)
            if isinstance(value, list):
                return [str(x) for x in value]
    return []


def _pick(source: dict[str, Any], keys: tuple[str, ...]) -> Any:
    """중첩된 응답에서 후보 키를 찾는다. 못 찾으면 None."""
    for key in keys:
        if key in source and source[key] is not None:
            return source[key]
    for value in source.values():
        if isinstance(value, dict):
            found = _pick(value, keys)
            if found is not None:
                return found
    return None


def fetch_order(order_id: str) -> dict[str, Any]:
    """주문번호로 상품주문 상세를 가져온다.

    반환에는 정규화한 값(status, amount)과 원본(raw)이 함께 들어간다. 필드명을
    확신할 수 없으므로, 자동 확인이 안 되더라도 운영자가 원본을 보고 판단할 수
    있어야 한다.
    """
    product_order_ids = _product_order_ids(order_id)
    if not product_order_ids:
        raise NaverCommerceError("not_found", "해당 주문번호의 상품주문을 찾지 못했습니다")

    body = _request(
        "POST", PRODUCT_ORDER_QUERY_PATH, json={"productOrderIds": product_order_ids}
    )

    items = body if isinstance(body, list) else (body.get("data") or body.get("contents") or [])
    if not isinstance(items, list) or not items:
        raise NaverCommerceError("not_found", "상품주문 상세를 받지 못했습니다")

    first = items[0] if isinstance(items[0], dict) else {}
    status = _pick(first, ("productOrderStatus", "orderStatus", "status"))
    amount = _pick(first, ("totalPaymentAmount", "totalPaymentAmt", "paymentAmount", "unitPrice"))

    return {
        "orderId": order_id,
        "productOrderIds": product_order_ids,
        "status": str(status) if status is not None else None,
        "amount": int(amount) if isinstance(amount, (int, float)) else None,
        "raw": items,
    }


def verify_payment(order_id: str, expected_amount: int) -> dict[str, Any]:
    """주문번호가 실제로 결제된 주문인지, 금액이 맞는지 판정한다.

    확신이 서지 않으면 verified=False 로 두고 이유를 남긴다. 사람이 보게 하는
    것이 틀린 자동 확인보다 낫다.
    """
    if not is_configured():
        return {"verified": False, "reason": "not_configured", "message": "네이버 커머스 API 가 설정되지 않았습니다"}

    try:
        order = fetch_order(order_id)
    except NaverCommerceError as error:
        return {"verified": False, "reason": error.code, "message": error.message}

    status = (order.get("status") or "").upper()
    amount = order.get("amount")

    if status in VOID_STATUSES:
        return {"verified": False, "reason": "voided", "message": f"취소·반품된 주문입니다 ({status})", "order": order}
    if status not in PAID_STATUSES:
        return {
            "verified": False,
            "reason": "not_paid",
            "message": f"결제 완료 상태가 아닙니다 ({status or '상태 불명'})",
            "order": order,
        }
    if amount is None:
        return {
            "verified": False,
            "reason": "amount_unknown",
            "message": "응답에서 결제 금액을 읽지 못했습니다. 직접 확인해 주세요.",
            "order": order,
        }
    if int(amount) < int(expected_amount):
        return {
            "verified": False,
            "reason": "amount_mismatch",
            "message": f"결제 금액이 예약금보다 적습니다 (결제 {amount}원 / 예약금 {expected_amount}원)",
            "order": order,
        }

    return {"verified": True, "reason": "ok", "message": "결제가 확인되었습니다", "order": order}

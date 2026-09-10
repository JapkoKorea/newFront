"""예약 알림.

지금까지는 예약이 들어와도 아무 데도 알리지 않았다. 운영자는 /admin 을 직접
열어 봐야 새 예약을 알았고, 고객은 예약이 확정됐는지 다시 들어와 확인해야
했다. 그 간극을 메운다.

수단은 메일이다. 문자나 카카오 알림톡은 사업자 심사와 건당 비용이 따르는데,
메일은 SMTP 설정만 있으면 바로 된다. 나중에 알림톡을 붙이더라도 이 모듈의
notify_* 함수는 그대로 두고 전송 계층만 갈아 끼우면 된다.

두 가지 원칙이 있다.

1. 알림 실패가 예약을 깨뜨리면 안 된다. 메일 서버가 죽어 있다고 해서 고객의
   예약이 실패하면 훨씬 나쁘다. 모든 전송은 예외를 삼키고 로그만 남긴다.
2. 설정이 없으면 조용히 넘어간다. SMTP 를 아직 안 붙였거나 로컬 개발 중일 때
   경고 한 줄만 남기고 지나간다 - 그것 때문에 기능이 막히지 않는다.
"""

import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

# 운영자에게 알릴 주소. 쉼표로 여러 명.
ADMIN_EMAILS = [
    address.strip()
    for address in os.getenv("ADMIN_NOTIFY_EMAILS", "").split(",")
    if address.strip()
]

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
# 보내는 사람. 대개 SMTP_USER 와 같지만 다를 수 있다(예: 별칭 발신).
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "잽코 택시투어").strip()

SITE_URL = os.getenv("SITE_URL", "https://japkokorea.com").rstrip("/")


def is_configured() -> bool:
    """메일을 실제로 보낼 수 있는 상태인지."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and SMTP_FROM)


def send_email(to: str | list[str], subject: str, body: str) -> bool:
    """메일 한 통. 성공 여부를 돌려주되 예외는 던지지 않는다."""
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [address.strip() for address in recipients if address and address.strip()]
    if not recipients:
        return False

    if not is_configured():
        print(f"[INFO] SMTP 미설정 - 메일을 건너뜁니다: {subject}")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    try:
        if SMTP_PORT == 465:
            # 465 는 처음부터 TLS 로 연결한다(SMTPS).
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10, context=ssl.create_default_context()) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(message)
        else:
            # 587 등은 평문으로 연결한 뒤 STARTTLS 로 올린다.
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(message)
        return True
    except Exception as error:  # noqa: BLE001 - 알림 실패가 본 작업을 막으면 안 된다
        # 비밀번호가 로그에 남지 않도록 예외 종류와 메시지만 남긴다.
        print(f"[WARN] 메일 발송 실패 ({type(error).__name__}): {error}")
        return False


def _line(label: str, value: Any) -> str:
    text = str(value or "").strip()
    return f"{label}: {text}\n" if text else ""


def _reservation_block(reservation: dict[str, Any]) -> str:
    """메일 본문에 공통으로 들어가는 예약 요약."""
    people = reservation.get("number_of_people") or reservation.get("numberOfPeople")
    return (
        _line("예약번호", reservation.get("reservation_number") or reservation.get("reservationNumber"))
        + _line("예약자", reservation.get("english_name") or reservation.get("englishName"))
        + _line("연락처", reservation.get("contact_number") or reservation.get("phoneNumber"))
        + _line("투어 날짜", reservation.get("tour_date") or reservation.get("tourDate"))
        + _line("시작 시간", reservation.get("tour_start_time") or reservation.get("tourStartTime"))
        + _line("인원", f"{people}명" if people else "")
        + _line("코스", reservation.get("tour_course") or reservation.get("tourCourse"))
        + _line("출발", reservation.get("departure"))
        + _line("도착", reservation.get("destination"))
    )


# --- 예약 접수 -------------------------------------------------------------

def notify_reservation_created(reservation: dict[str, Any], customer_email: str = "") -> None:
    """예약이 들어왔을 때. 운영자에게는 항상, 고객에게는 메일 주소가 있을 때."""
    summary = _reservation_block(reservation)
    number = reservation.get("reservation_number") or reservation.get("reservationNumber") or ""

    if ADMIN_EMAILS:
        send_email(
            ADMIN_EMAILS,
            f"[잽코] 새 예약 - {reservation.get('tour_date') or reservation.get('tourDate') or ''}",
            "새 예약이 접수되었습니다.\n\n"
            + summary
            + f"\n확인: {SITE_URL}/admin\n",
        )

    if customer_email:
        send_email(
            customer_email,
            "[잽코 택시투어] 예약이 접수되었습니다",
            "예약 신청이 접수되었습니다.\n\n"
            + summary
            + "\n아직 확정된 것은 아닙니다. 담당자가 일정을 확인한 뒤 확정 안내를 다시 보내 드립니다.\n"
            + f"\n예약 확인: {SITE_URL}/reservations\n"
            + f"예약번호: {number}\n",
        )


# --- 예약 상태 변경 ---------------------------------------------------------

# 상태별 제목과 첫 문장. 고객이 받는 메일이므로 다음에 무엇을 해야 하는지 적는다.
_STATUS_MESSAGES = {
    "confirmed": (
        "예약이 확정되었습니다",
        "예약이 확정되었습니다. 아래 일정으로 모시겠습니다.",
    ),
    "rejected": (
        "예약을 받지 못했습니다",
        "죄송합니다. 신청하신 일정으로는 예약을 받지 못했습니다.",
    ),
    "cancelled": (
        "예약이 취소되었습니다",
        "예약이 취소 처리되었습니다.",
    ),
    "completed": (
        "이용해 주셔서 감사합니다",
        "투어가 완료되었습니다. 이용해 주셔서 감사합니다.",
    ),
}


def notify_status_changed(
    reservation: dict[str, Any],
    new_status: str,
    customer_email: str = "",
    reason: str = "",
) -> None:
    """운영자가 예약 상태를 바꿨을 때 고객에게."""
    message = _STATUS_MESSAGES.get(new_status)
    if not message or not customer_email:
        # 안내할 말이 정해지지 않은 상태 변경이거나, 보낼 곳이 없다.
        return

    subject, opening = message
    body = opening + "\n\n" + _reservation_block(reservation)
    if reason.strip() and new_status in {"rejected", "cancelled"}:
        body += f"\n사유: {reason.strip()}\n"
    if new_status == "confirmed":
        body += f"\n예약금 안내: {SITE_URL}/payments\n"
    if new_status == "completed":
        body += f"\n후기 남기기: {SITE_URL}/reservations\n"
    body += f"\n예약 확인: {SITE_URL}/reservations\n"

    send_email(customer_email, f"[잽코 택시투어] {subject}", body)


# --- 운영자에게 알릴 고객 행동 ------------------------------------------------

def notify_cancel_requested(reservation: dict[str, Any]) -> None:
    """고객이 취소를 요청했을 때. 운영자가 처리해야 한다."""
    if not ADMIN_EMAILS:
        return
    send_email(
        ADMIN_EMAILS,
        "[잽코] 예약 취소 요청",
        "고객이 예약 취소를 요청했습니다.\n\n"
        + _reservation_block(reservation)
        + f"\n처리: {SITE_URL}/admin\n",
    )


def notify_payment_declared(
    reservation: dict[str, Any],
    channel: str = "",
    order_no: str = "",
) -> None:
    """고객이 결제했다고 알렸을 때. 운영자가 통장이나 스토어를 대조해야 한다."""
    if not ADMIN_EMAILS:
        return
    channel_label = {"transfer": "계좌이체", "naver": "네이버 스마트스토어"}.get(channel, channel)
    send_email(
        ADMIN_EMAILS,
        "[잽코] 결제 확인 요청",
        "고객이 결제했다고 알렸습니다. 확인이 필요합니다.\n\n"
        + _reservation_block(reservation)
        + _line("결제 수단", channel_label)
        + _line("주문번호", order_no)
        + f"\n확인: {SITE_URL}/admin\n",
    )

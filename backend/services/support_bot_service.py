"""상담 봇 — 1차 응답과 운영자 전달.

역할은 두 가지다.

1. 자주 묻는 것에 즉시 답한다. 운영자가 같은 답을 반복하지 않게 한다.
2. 답할 수 없는 문의는 운영자에게 넘긴다. 고객에게는 전달됐다고 알린다.

LLM 을 쓰지 않는다. 요금·기한 같은 사실을 지어내면 안 되는 영역이라,
정책 상수에서 직접 문장을 만든다. japko/Backend 의 예약 정보 추출
에이전트(reservation_kakaobiz)를 붙이는 것은 다음 단계다.

주의: 시간당 요금은 프론트(src/lib/pricing.js)가 정본이다. 여기 값은
그 표를 옮겨 적은 것이므로 요금을 바꿀 때 두 곳을 함께 고쳐야 한다.
"""

import os
import re
from typing import Any

from services.change_request_service import DATE_CHANGE_MIN_DAYS, TIME_CHANGE_MIN_DAYS
from services.refund_service import FULL_REFUND_DAYS


# src/lib/pricing.js 의 HOURLY_RATE 와 같은 값이어야 한다.
HOURLY_RATE_JPY = {
    "일반차량": 8640,
    "사륜구동 차량": 13640,
    "점보택시": 10940,
}
MINIMUM_HOURS = 2


def _deposit_krw() -> tuple[int, int]:
    base = int(os.getenv("BASE_DEPOSIT_KRW", "15000"))
    last_minute = int(os.getenv("LAST_MINUTE_DEPOSIT_KRW", "20000"))
    return base, last_minute


def _won(value: int) -> str:
    return f"{value:,}원"


def _yen(value: int) -> str:
    return f"{value:,}엔"


def _answer_fare() -> str:
    return (
        f"시간당 요금은 일반 택시 {_yen(HOURLY_RATE_JPY['일반차량'])}, "
        f"점보 택시(5인 이상) {_yen(HOURLY_RATE_JPY['점보택시'])}입니다. "
        f"최소 이용 시간은 {MINIMUM_HOURS}시간이며, 계절과 관계없이 같은 요금이 적용됩니다. "
        "택시 요금은 투어 당일 현지에서 기사님께 직접 결제합니다."
    )


def _answer_deposit() -> str:
    base, last_minute = _deposit_krw()
    return (
        f"예약 시에는 예약금만 결제합니다. 일반 예약은 {_won(base)}, "
        f"투어 당일이나 하루 전에 신청하는 전일 예약은 {_won(last_minute)}입니다. "
        "택시 요금은 예약금에 포함되지 않습니다."
    )


def _answer_cancel() -> str:
    return (
        f"투어 {FULL_REFUND_DAYS}일 전까지 취소하시면 예약금을 전액 환불해 드립니다. "
        f"{FULL_REFUND_DAYS}일 이내에는 예약금 환불이 어렵습니다. "
        "당일 취소와 미탑승의 경우 택시 이용요금이 별도로 청구됩니다. "
        "취소는 예약 확인 화면에서 직접 하실 수 있습니다."
    )


def _answer_change() -> str:
    return (
        f"날짜 변경은 투어 {DATE_CHANGE_MIN_DAYS}일 전까지, "
        f"이용 시간 변경은 {TIME_CHANGE_MIN_DAYS}일 전까지 신청하실 수 있습니다. "
        "예약 확인 화면의 '변경 요청'에서 신청하시면 배차를 확인해 안내드립니다. "
        "투어 당일 변경은 이곳 상담으로 문의해 주세요."
    )


def _answer_vehicle() -> str:
    return (
        "1~4인은 일반 택시, 5인 이상은 12인승 점보 택시로 배차됩니다. "
        "4인 이하라도 캐리어가 많으면 점보 택시를 이용하셔야 할 수 있습니다."
    )


def _answer_winter() -> str:
    return (
        f"적설기에는 사륜구동 차량으로 배차되어 눈길 이동이 안전합니다. "
        f"사륜구동 차량은 시간당 {_yen(HOURLY_RATE_JPY['사륜구동 차량'])}으로, "
        "일반 택시에 5,000엔이 더해진 요금입니다."
    )


def _answer_payment_method() -> str:
    return (
        "예약금은 예약 화면에서 카드나 계좌이체로 결제하시고, "
        "택시 요금은 투어 당일 현지에서 기사님께 현금으로 결제합니다."
    )


def _answer_duration() -> str:
    return (
        f"최소 {MINIMUM_HOURS}시간부터 이용하실 수 있고, 3~6시간 코스를 많이 선택하십니다. "
        "투어 중에 시간이 부족하면 현지에서 1시간 단위로 추가하실 수 있습니다."
    )


def _answer_course() -> str:
    return (
        "겨울과 여름 시즌별로 코스를 준비해 두었습니다. "
        "상품 페이지에서 코스를 고르시면 경로가 채워진 채로 예약이 시작됩니다. "
        "코스는 예약 후에 정하시거나 현지에서 기사님께 말씀하셔도 됩니다."
    )


# 규칙은 위에서부터 검사한다. 좁은 주제를 먼저 두어야 넓은 주제에 먹히지 않는다.
# 예: "겨울에 눈길 괜찮나요" 는 '요금' 규칙보다 '겨울' 규칙이 먼저 잡아야 한다.
#
# keywords 는 부분 문자열, patterns 는 정규식으로 검사한다.
RULES: list[dict[str, Any]] = [
    {
        "topic": "winter",
        "keywords": ["눈길", "눈이", "설상", "사륜", "4wd", "겨울에 운전", "미끄럽", "체인"],
        "answer": _answer_winter,
    },
    {
        "topic": "change",
        "keywords": ["변경", "바꾸", "미루", "옮기", "일정 조정", "날짜를 바꿔"],
        "answer": _answer_change,
    },
    {
        "topic": "cancel",
        "keywords": ["취소", "환불", "노쇼", "못 가", "못가"],
        "answer": _answer_cancel,
    },
    {
        "topic": "deposit",
        "keywords": ["예약금", "보증금", "수수료", "선결제"],
        "answer": _answer_deposit,
    },
    {
        "topic": "payment",
        "keywords": ["결제 방법", "현금", "카드", "어떻게 결제", "계좌"],
        "answer": _answer_payment_method,
    },
    {
        "topic": "vehicle",
        "keywords": ["점보", "인원", "몇 명", "몇명", "캐리어", "차량", "어떤 차", "차종", "밴", "승합", "짐"],
        # "6명인데 어떤 차가 오나요" 처럼 숫자로 인원을 말하는 경우.
        # 숫자+명 만으로는 부족하다. "2명인데 얼마인가요" 는 요금 질문이므로,
        # 가까이에 차량을 가리키는 말이 있을 때만 차량 주제로 본다.
        "patterns": [r"\d+\s*명.{0,12}(차|타|배차)"],
        "answer": _answer_vehicle,
    },
    {
        "topic": "duration",
        "keywords": ["몇 시간", "소요", "시간이 얼마", "몇시간", "얼마나 걸"],
        "answer": _answer_duration,
    },
    {
        "topic": "course",
        "keywords": ["코스", "어디를", "관광지", "명소", "일정 추천"],
        "answer": _answer_course,
    },
    {
        "topic": "fare",
        "keywords": ["요금", "가격", "얼마", "비용", "금액"],
        "answer": _answer_fare,
    },
]

GREETING_PATTERNS = ["안녕", "hello", "hi ", "문의", "상담"]

HANDOFF_NOTICE = "확인 후 담당자가 답변드리겠습니다."

FALLBACK = (
    "문의 내용을 담당자에게 전달했습니다. 확인 후 답변드리겠습니다.\n"
    "급하신 경우 카카오 채널로도 문의하실 수 있습니다."
)

GREETING = (
    "안녕하세요, 잽코 택시투어입니다.\n"
    "요금, 예약금, 코스, 취소·변경 규정은 바로 안내해 드릴 수 있습니다. "
    "그 밖의 문의는 담당자에게 전달됩니다."
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip().lower()


def build_reply(user_message: str) -> dict[str, Any]:
    """사용자 메시지에 대한 봇 응답과 운영자 전달 필요 여부를 돌려준다.

    반환값의 needs_admin 이 True 면 운영자가 확인해야 하는 문의다.
    """
    text = _normalize(user_message)

    if not text:
        return {"reply": FALLBACK, "topic": None, "needs_admin": True}

    # 인사만 있고 다른 내용이 없으면 안내 문구로 응답한다.
    if len(text) <= 12 and any(pattern in text for pattern in GREETING_PATTERNS):
        return {"reply": GREETING, "topic": "greeting", "needs_admin": False}

    for rule in RULES:
        matched = any(keyword in text for keyword in rule["keywords"])
        if not matched:
            matched = any(re.search(pattern, text) for pattern in rule.get("patterns", []))
        if matched:
            return {
                "reply": f"{rule['answer']()}\n\n더 궁금한 점이 있으면 말씀해 주세요. {HANDOFF_NOTICE}",
                "topic": rule["topic"],
                # 규칙으로 답했어도 사람이 한 번 확인하는 편이 안전하다.
                # 답을 준 문의는 대기열에서 뒤로 밀린다(운영자 목록에서 구분).
                "needs_admin": False,
            }

    return {"reply": FALLBACK, "topic": None, "needs_admin": True}

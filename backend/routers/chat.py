"""상담 채팅 API (로그인 필요).

폴링 방식: 프론트가 GET /api/chat/messages?conversation_id=&after=<last_id> 를 주기 호출.
관리자 답장은 공유 DB를 보는 기존 LINE/카카오 챗 백엔드에서 기록되며 동일 테이블로 조회된다.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from dependencies.auth import get_current_user
from services.mysql_chat_service import (
    create_message,
    get_or_create_open_conversation,
    list_messages,
)
from services.support_bot_service import build_reply

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ConversationRequest(BaseModel):
    reservation_number: str | None = None


class ConversationResponse(BaseModel):
    id: str
    status: str
    reservationNumber: str | None = None


class MessageInput(BaseModel):
    conversation_id: str
    body: str = Field(min_length=1, max_length=2000)


def _user_id(current_user: dict[str, Any]) -> str:
    user_id = str(current_user.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="토큰 사용자 정보가 올바르지 않습니다")
    return user_id


@router.post("/conversations", response_model=ConversationResponse)
async def open_conversation(
    payload: ConversationRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    conversation = get_or_create_open_conversation(
        _user_id(current_user), payload.reservation_number
    )
    return ConversationResponse(
        id=conversation["id"],
        status=conversation["status"],
        reservationNumber=conversation.get("reservationNumber"),
    )


@router.get("/messages")
async def get_messages(
    conversation_id: str = Query(...),
    after: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, list[dict[str, Any]]]:
    messages = list_messages(conversation_id, _user_id(current_user), after)
    return {"messages": messages}


@router.post("/messages")
async def post_message(
    payload: MessageInput,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요")

    message = create_message(payload.conversation_id, _user_id(current_user), body)
    if message is None:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")

    # 봇이 즉시 1차 응답을 남긴다. 답하지 못한 문의는 운영자 대기열로 넘어간다
    # (운영자 목록에서 마지막 발신자가 user 또는 bot-fallback 인 대화로 판별).
    bot = build_reply(body)
    bot_message = create_message(
        payload.conversation_id,
        _user_id(current_user),
        bot["reply"],
        sender="bot",
    )

    return {
        "message": message,
        "botMessage": bot_message,
        "needsAdmin": bot["needs_admin"],
    }

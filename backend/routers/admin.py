"""운영자용 API.

권한은 users.role 로 판정하며, 토큰이 아니라 매 요청 DB 에서 읽는다
(dependencies/auth.py 의 get_current_admin 참고).

예약 변경 요청 처리와 상담 인박스를 다룬다. 예약 확정/거절 등 다른 운영
동작은 필요해질 때 이 라우터에 추가한다.
"""

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from dependencies.auth import get_current_admin
from services.change_request_service import (
    ChangeRequestError,
    get_change_request,
    list_all_change_requests,
    resolve_change_request,
)
from services.mysql_chat_service import (
    create_admin_message,
    list_conversations_for_admin,
    list_messages_for_admin,
)


router = APIRouter(prefix="/api/admin", tags=["admin"])


class ResolvePayload(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: str | None = Field(default=None, max_length=1000)


@router.get("/me")
async def whoami(current_admin: dict[str, Any] = Depends(get_current_admin)):
    """관리자 화면 진입 시 권한 확인용."""
    return {
        "userId": current_admin.get("user_id"),
        "displayName": current_admin.get("display_name"),
        "role": current_admin.get("role"),
    }


@router.get("/change-requests")
async def get_change_requests(
    status: Literal["pending", "approved", "rejected", "cancelled"] | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """변경 요청 목록. 대기 중인 것이 먼저 나온다."""
    return {"requests": list_all_change_requests(status=status, limit=limit)}


@router.patch("/change-requests/{request_id}")
async def resolve_request(
    request_id: int,
    payload: ResolvePayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """변경 요청을 승인하거나 거절한다.

    승인하면 예약 일정이 실제로 갱신되고 이력이 남는다.
    """
    admin_id = str(current_admin.get("user_id") or "").strip()

    try:
        result = resolve_change_request(
            request_id=request_id,
            decision=payload.status,
            admin_user_id=admin_id,
            admin_note=payload.admin_note,
        )
    except ChangeRequestError as error:
        status_code = 404 if error.code == "not_found" else 409
        raise HTTPException(status_code=status_code, detail=error.message) from error

    return {
        "message": "승인했습니다." if payload.status == "approved" else "거절했습니다.",
        **result,
        "request": get_change_request(request_id),
    }


class AdminReplyPayload(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.get("/conversations")
async def get_conversations(
    unanswered: bool = Query(False, description="답변이 필요한 대화만"),
    limit: int = Query(100, ge=1, le=500),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """상담 인박스 목록.

    unanswered 는 마지막 고객 메시지 이후 운영자 답변이 없는 대화다.
    봇 응답은 답변으로 치지 않는다.
    """
    return {"conversations": list_conversations_for_admin(only_unanswered=unanswered, limit=limit)}


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    after: int = Query(0, ge=0),
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    return {"messages": list_messages_for_admin(conversation_id, after)}


@router.post("/conversations/{conversation_id}/messages")
async def reply_to_conversation(
    conversation_id: str,
    payload: AdminReplyPayload,
    current_admin: dict[str, Any] = Depends(get_current_admin),
):
    """운영자 답변. 고객 화면에는 폴링으로 곧 나타난다."""
    message = create_admin_message(conversation_id, payload.body.strip())
    if message is None:
        raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")
    return {"message": message}

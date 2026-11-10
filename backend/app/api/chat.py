from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.deps import ServicesDep
from app.core.sse import SSE_HEADERS, with_heartbeat
from app.schemas import ChatRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(payload: ChatRequest, services: ServicesDep):
    allowed, retry_after = await services.limiter.acquire()

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "code": "RATE_LIMITED",
                "message": f"请求过于频繁，请 {retry_after} 秒后重试",
            },
            headers={"Retry-After": str(retry_after)},
        )

    events = services.chat.stream(payload.session_id, payload.question)

    return StreamingResponse(
        with_heartbeat(events),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )

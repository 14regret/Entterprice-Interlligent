from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@dataclass(slots=True)
class SseEvent:
    event: str
    data: dict[str, Any] = field(default_factory=dict)


def format_sse(event: SseEvent) -> str:
    payload = json.dumps(event.data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event.event}\ndata: {payload}\n\n"


def meta_event(citations: list[dict], cached: bool, session_id: str) -> SseEvent:
    return SseEvent(
        "meta",
        {"citations": citations, "cached": cached, "sessionId": session_id},
    )


def token_event(text: str) -> SseEvent:
    return SseEvent("token", {"t": text})


def done_event(answer_id: str, elapsed_ms: int) -> SseEvent:
    return SseEvent("done", {"answerId": answer_id, "elapsedMs": elapsed_ms})


def error_event(code: str, message: str) -> SseEvent:
    return SseEvent("error", {"code": code, "message": message})


async def with_heartbeat(
    source: AsyncIterator[SseEvent], interval: float = 15.0
) -> AsyncIterator[str]:
    """
    Wrap an event iterator with SSE comment heartbeats.

    `asyncio.wait_for` would cancel a pending model read on timeout, which
    truncates generation. Keeping the pending `__anext__` task alive lets the
    heartbeat interleave without touching the stream.
    """
    iterator = source.__aiter__()
    pending: asyncio.Task[SseEvent] | None = None

    try:
        while True:
            if pending is None:
                pending = asyncio.create_task(anext(iterator))

            done, _ = await asyncio.wait({pending}, timeout=interval)
            if not done:
                yield ": ping\n\n"
                continue

            task, pending = pending, None
            try:
                event = task.result()
            except StopAsyncIteration:
                break

            yield format_sse(event)
    finally:
        if pending is not None:
            pending.cancel()
            with suppress(asyncio.CancelledError):
                await pending

        aclose = getattr(iterator, "aclose", None)
        if aclose is not None:
            with suppress(Exception):
                await aclose()

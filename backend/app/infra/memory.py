from __future__ import annotations

import json
import logging
from typing import Any

from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class SessionMemory:
    """Last N turns per session, stored as a Redis list with a sliding TTL."""

    def __init__(
        self,
        redis: Redis | None,
        *,
        ttl_seconds: int,
        max_turns: int,
    ) -> None:
        self._redis = redis
        self._ttl = ttl_seconds
        self._max_turns = max(1, max_turns)

    @staticmethod
    def _key(session_id: str) -> str:
        return f"session:{session_id}:history"

    async def load(self, session_id: str) -> list[dict[str, str]]:
        if self._redis is None:
            return []

        try:
            raw = await self._redis.lrange(
                self._key(session_id), -self._max_turns * 2, -1
            )
        except Exception as exc:
            logger.warning("session memory read failed: %s", exc)
            return []

        messages: list[dict[str, str]] = []
        for item in raw:
            try:
                parsed: dict[str, Any] = json.loads(item)
            except json.JSONDecodeError:
                continue

            role = parsed.get("role")
            content = parsed.get("content")
            if role in {"user", "assistant"} and isinstance(content, str) and content:
                messages.append({"role": role, "content": content})

        return messages

    async def append(self, session_id: str, question: str, answer: str) -> None:
        if self._redis is None:
            return

        key = self._key(session_id)
        try:
            pipe = self._redis.pipeline(transaction=False)
            pipe.rpush(
                key,
                json.dumps(
                    {"role": "user", "content": question}, ensure_ascii=False
                ),
            )
            pipe.rpush(
                key,
                json.dumps(
                    {"role": "assistant", "content": answer}, ensure_ascii=False
                ),
            )
            pipe.ltrim(key, -self._max_turns * 2, -1)
            pipe.expire(key, self._ttl)
            await pipe.execute()
        except Exception as exc:
            logger.warning("session memory write failed: %s", exc)

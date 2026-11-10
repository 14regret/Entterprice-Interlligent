from __future__ import annotations

import logging
from typing import Any

from redis.asyncio import ConnectionPool, Redis

logger = logging.getLogger(__name__)


class RedisStore:
    """Owns the redis.asyncio connection pool for the app lifespan."""

    def __init__(self, url: str, *, max_connections: int = 20) -> None:
        self._url = url
        self._max_connections = max_connections
        self._pool: ConnectionPool | None = None
        self._client: Redis | None = None

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def client(self) -> Redis:
        if self._client is None:
            raise RuntimeError("Redis 尚未连接")
        return self._client

    async def connect(self) -> None:
        pool = ConnectionPool.from_url(
            self._url,
            decode_responses=True,
            max_connections=self._max_connections,
            socket_timeout=5,
            socket_connect_timeout=3,
            health_check_interval=30,
            # Redis 5.x has no HELLO command; force RESP2 or redis-py 8 fails.
            protocol=2,
        )
        client = Redis(connection_pool=pool)

        try:
            await client.ping()
        except Exception:
            await pool.disconnect()
            raise

        self._pool = pool
        self._client = client
        logger.info("Redis connected (%s)", self._url)

    async def health(self) -> tuple[bool, str | None]:
        if self._client is None:
            return False, None

        try:
            await self._client.ping()
            info: dict[str, Any] = await self._client.info("server")
            version = info.get("redis_version")
            return True, str(version) if version else None
        except Exception:
            return False, None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

        if self._pool is not None:
            await self._pool.disconnect()
            self._pool = None

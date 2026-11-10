from __future__ import annotations

import logging
import time

from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# Token bucket: capacity tokens, refilled continuously at `refill` per second.
# Redis 5 compatible (HSET multi-field, PEXPIRE).
TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then tokens = capacity end
if ts == nil then ts = now end

local elapsed = math.max(0, now - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * refill)

if tokens < cost then
  redis.call('HSET', key, 'tokens', tokens, 'ts', now)
  redis.call('PEXPIRE', key, 120000)
  return 0
end

tokens = tokens - cost
redis.call('HSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, 120000)
return 1
"""


class RateLimiter:
    """Global token bucket shared by every chat request."""

    def __init__(self, redis: Redis | None, limit_per_minute: int) -> None:
        self._redis = redis
        self._limit = max(1, limit_per_minute)
        self._capacity = float(self._limit)
        self._refill = self._limit / 60.0
        self._script = redis.register_script(TOKEN_BUCKET_LUA) if redis else None

    async def acquire(self, cost: int = 1) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds). Fails open without Redis."""
        if self._redis is None or self._script is None:
            return True, 0

        try:
            allowed = await self._script(
                keys=["ratelimit:global"],
                args=[
                    self._capacity,
                    self._refill,
                    int(time.time() * 1000),
                    cost,
                ],
            )
        except Exception as exc:  # Redis outage must not take chat down
            logger.warning("rate limiter unavailable, failing open: %s", exc)
            return True, 0

        if int(allowed) == 1:
            return True, 0

        retry_after = max(1, int(60 / self._limit))
        return False, retry_after

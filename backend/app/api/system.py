from __future__ import annotations

import asyncio

from fastapi import APIRouter

from app.api.deps import ServicesDep
from app.schemas import (
    DocumentStatus,
    HealthResponse,
    IndexHealth,
    OllamaHealth,
    RedisHealth,
)

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health(services: ServicesDep) -> HealthResponse:
    (ollama_ok, model), (redis_ok, version) = await asyncio.gather(
        services.gateway.health(),
        services.redis.health(),
    )

    ready = [
        item
        for item in services.registry.all()
        if item.status is DocumentStatus.READY
    ]

    if ollama_ok and redis_ok:
        status = "ok"
    elif not ollama_ok and not redis_ok:
        status = "offline"
    else:
        status = "degraded"

    return HealthResponse(
        status=status,
        ollama=OllamaHealth(reachable=ollama_ok, model=model),
        redis=RedisHealth(reachable=redis_ok, version=version),
        index=IndexHealth(
            documents=len(ready),
            chunks=sum(item.chunks for item in ready),
        ),
    )

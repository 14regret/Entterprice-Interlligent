from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentMeta(CamelModel):
    id: str
    name: str
    pages: int = 0
    chunks: int = 0
    size_bytes: int
    status: DocumentStatus
    uploaded_at: str
    error: str | None = None


class OllamaHealth(CamelModel):
    reachable: bool
    model: str


class RedisHealth(CamelModel):
    reachable: bool
    version: str | None = None


class IndexHealth(CamelModel):
    documents: int
    chunks: int


class HealthResponse(CamelModel):
    status: str
    ollama: OllamaHealth
    redis: RedisHealth
    index: IndexHealth

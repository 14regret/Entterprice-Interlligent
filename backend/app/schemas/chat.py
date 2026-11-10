from __future__ import annotations

from pydantic import Field

from app.schemas.documents import CamelModel


class ChatRequest(CamelModel):
    session_id: str = Field(min_length=1, max_length=128)
    question: str = Field(min_length=1, max_length=2000)


class Citation(CamelModel):
    id: str
    doc_id: str
    doc_name: str
    page: int
    chunk_id: str
    score: float
    snippet: str | None = None

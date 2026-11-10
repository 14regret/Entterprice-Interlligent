from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import AsyncIterator

from app.config import Settings
from app.core.sse import (
    SseEvent,
    done_event,
    error_event,
    meta_event,
    token_event,
)
from app.infra.memory import SessionMemory
from app.infra.semantic_cache import SemanticCache
from app.llm.ollama_client import OllamaGateway
from app.rag.embeddings import Embedder
from app.rag.fusion import Candidate
from app.rag.prompting import (
    REFUSAL_TEXT,
    build_context,
    build_messages,
    has_citation_marker,
    is_insufficient,
)
from app.rag.retriever import Retriever
from app.schemas import Citation

logger = logging.getLogger(__name__)


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _to_citations(candidates: list[Candidate]) -> list[Citation]:
    return [
        Citation(
            id=candidate.chunk_id,
            doc_id=candidate.doc_id,
            doc_name=candidate.doc_name,
            page=candidate.page,
            chunk_id=candidate.chunk_id,
            score=round(candidate.score, 3),
            snippet=candidate.text[:160],
        )
        for candidate in candidates
    ]


class ChatService:
    def __init__(
        self,
        settings: Settings,
        gateway: OllamaGateway,
        embedder: Embedder,
        retriever: Retriever,
        cache: SemanticCache,
        memory: SessionMemory,
    ) -> None:
        self._settings = settings
        self._gateway = gateway
        self._embedder = embedder
        self._retriever = retriever
        self._cache = cache
        self._memory = memory

    async def stream(self, session_id: str, question: str) -> AsyncIterator[SseEvent]:
        started = time.perf_counter()

        try:
            embedding = await self._embedder.embed_query(question)
        except Exception as exc:
            logger.exception("query embedding failed")
            yield error_event(
                "MODEL_UNAVAILABLE",
                "无法调用本地向量模型，请确认 Ollama 已启动且已拉取 nomic-embed-text",
            )
            return

        cached = None
        try:
            cached = await self._cache.lookup(question, embedding)
        except Exception as exc:
            logger.warning("semantic cache lookup failed: %s", exc)

        if cached is not None:
            payload = [item.model_dump(by_alias=True) for item in cached.citations]
            yield meta_event(payload, True, session_id)
            yield token_event(cached.answer)
            await self._memory.append(session_id, question, cached.answer)
            yield done_event(uuid.uuid4().hex, _elapsed_ms(started))
            return

        try:
            result = await self._retriever.retrieve(question, embedding)
        except Exception:
            logger.exception("retrieval failed")
            yield error_event("RETRIEVAL_FAILED", "检索失败，请稍后重试")
            return

        if not result.confident or not result.candidates:
            yield meta_event([], False, session_id)
            yield token_event(REFUSAL_TEXT)
            yield done_event(uuid.uuid4().hex, _elapsed_ms(started))
            return

        citations = _to_citations(result.candidates)
        yield meta_event(
            [item.model_dump(by_alias=True) for item in citations],
            False,
            session_id,
        )

        history = await self._memory.load(session_id)
        messages = build_messages(
            history,
            question,
            build_context(result.candidates),
        )

        parts: list[str] = []

        try:
            async with asyncio.timeout(self._settings.generation_timeout_seconds):
                async for delta in self._gateway.chat_stream(messages):
                    parts.append(delta)
                    yield token_event(delta)
        except TimeoutError:
            logger.warning("generation timed out after %ss", self._settings.generation_timeout_seconds)
            yield error_event("GENERATION_TIMEOUT", "本地模型响应超时，请缩短问题后重试")
            return
        except Exception:
            logger.exception("generation failed")
            yield error_event("GENERATION_FAILED", "本地模型生成中断，请重试")
            return

        answer = "".join(parts).strip()

        if not answer:
            yield error_event("EMPTY_ANSWER", "模型没有返回内容，请重试")
            return

        insufficient = is_insufficient(answer)

        # The pre-generation meta cannot know that the model will call the
        # context insufficient; clear the evidence margin in that case so a
        # refusal never wears citations.
        if insufficient and citations:
            yield meta_event([], False, session_id)

        # qwen2:1.5b routinely ignores the citation format instruction. The
        # evidence margin still lists every source, so append the primary
        # marker to keep a machine-checkable link between answer and source.
        if not insufficient and citations and not has_citation_marker(answer):
            suffix = " [1]"
            answer = f"{answer}{suffix}"
            yield token_event(suffix)

        if not insufficient:
            await self._memory.append(session_id, question, answer)
            await self._cache.store(question, embedding, answer, citations)

        yield done_event(uuid.uuid4().hex, _elapsed_ms(started))

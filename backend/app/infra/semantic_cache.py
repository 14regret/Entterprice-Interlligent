from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import time
from dataclasses import dataclass

import numpy as np
from redis.asyncio import Redis

from app.config import Settings
from app.rag.keyword_index import tokenize
from app.rag.vector_store import VectorStore
from app.schemas import Citation

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CacheHit:
    answer: str
    citations: list[Citation]
    similarity: float


def _encode(vector: list[float]) -> str:
    return base64.b64encode(
        np.asarray(vector, dtype=np.float32).tobytes()
    ).decode("ascii")


def _decode(payload: str) -> np.ndarray:
    return np.frombuffer(base64.b64decode(payload), dtype=np.float32)


def _question_overlap(question: str, cached_question: str) -> float:
    """Share of the new question's content words present in the cached one."""
    query_tokens = set(tokenize(question))
    if not query_tokens:
        return 0.0

    cached_tokens = set(tokenize(cached_question))
    if not cached_tokens:
        return 0.0

    return len(query_tokens & cached_tokens) / len(query_tokens)


class SemanticCache:
    """
    Semantic answer cache.

    Chroma's separate `semantic_cache` collection does the ANN recall; Redis
    stores the full answer payload. If Chroma is unavailable, the most recent
    Redis vectors are scanned with numpy cosine. That fallback matters on this
    host because Redis 5.0 has no vector index of its own.
    """

    def __init__(
        self,
        settings: Settings,
        redis: Redis | None,
        vector_store: VectorStore,
    ) -> None:
        self._settings = settings
        self._redis = redis
        self._store = vector_store
        self._threshold = settings.semantic_cache_threshold

    async def lookup(
        self, question: str, embedding: list[float]
    ) -> CacheHit | None:
        key: str | None = None
        similarity = 0.0
        cached_question = ""

        try:
            key, similarity, cached_question = await asyncio.to_thread(
                self._query_collection, embedding
            )
        except Exception as exc:
            logger.warning("semantic cache ANN lookup failed: %s", exc)

        if (
            key
            and similarity >= self._threshold
            and self._is_lexically_compatible(question, cached_question)
        ):
            hit = await self._load_payload(key, similarity)
            if hit is not None:
                logger.info("semantic cache hit (chroma): %.3f", similarity)
                return hit

        fallback = await self._lookup_recent(question, embedding)
        if fallback is not None:
            logger.info("semantic cache hit (redis fallback): %.3f", fallback.similarity)
        return fallback

    def _is_lexically_compatible(self, question: str, cached_question: str) -> bool:
        if not cached_question:
            return False

        overlap = _question_overlap(question, cached_question)
        if overlap < self._settings.cache_min_question_overlap:
            logger.info(
                "semantic cache rejected by lexical guard: overlap=%.2f cached=%r",
                overlap,
                cached_question,
            )
            return False

        return True

    def _query_collection(
        self, embedding: list[float]
    ) -> tuple[str | None, float, str]:
        collection = self._store.cache
        if int(collection.count()) == 0:
            return None, 0.0, ""

        result = collection.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["metadatas", "distances"],
        )

        metadatas = result.get("metadatas") or [[]]
        distances = result.get("distances") or [[]]
        if not metadatas[0]:
            return None, 0.0, ""

        metadata = metadatas[0][0] or {}
        distance = float(distances[0][0])
        similarity = max(0.0, min(1.0, 1.0 - distance))
        return (
            metadata.get("answer_key"),
            similarity,
            str(metadata.get("question", "")),
        )

    async def _load_payload(self, key: str, similarity: float) -> CacheHit | None:
        if self._redis is None:
            return None

        try:
            raw = await self._redis.get(f"cache:answer:{key}")
        except Exception as exc:
            logger.warning("semantic cache payload read failed: %s", exc)
            return None

        if not raw:
            return None

        try:
            payload = json.loads(raw)
            citations = [
                Citation.model_validate(item)
                for item in payload.get("citations", [])
            ]
            answer = str(payload["answer"])
        except Exception as exc:
            logger.warning("semantic cache payload invalid: %s", exc)
            return None

        return CacheHit(answer=answer, citations=citations, similarity=similarity)

    async def _lookup_recent(
        self, question: str, embedding: list[float]
    ) -> CacheHit | None:
        if self._redis is None:
            return None

        try:
            entries = await self._redis.lrange("cache:recent", 0, -1)
        except Exception:
            return None

        if not entries:
            return None

        query = np.asarray(embedding, dtype=np.float32)
        query_norm = float(np.linalg.norm(query))
        if query_norm == 0:
            return None

        best_key: str | None = None
        best_question = ""
        best_similarity = self._threshold - 1.0

        for raw in entries:
            try:
                record = json.loads(raw)
                vector = _decode(record["v"])
                key = str(record["key"])
                cached_question = str(record.get("question", ""))
            except Exception:
                continue

            norm = float(np.linalg.norm(vector))
            if norm == 0:
                continue

            similarity = float(np.dot(query, vector) / (query_norm * norm))
            if similarity > best_similarity:
                best_similarity = similarity
                best_key = key
                best_question = cached_question

        if best_key is None or best_similarity < self._threshold:
            return None
        if not self._is_lexically_compatible(question, best_question):
            return None

        return await self._load_payload(best_key, best_similarity)

    async def store(
        self,
        question: str,
        embedding: list[float],
        answer: str,
        citations: list[Citation],
    ) -> None:
        if not answer.strip() or not citations:
            return
        if self._redis is None:
            # Without Redis there is nowhere to keep the answer payload, so a
            # vector-only cache entry would never be usable.
            return

        key = hashlib.sha1(
            f"{question}\x00{answer}".encode("utf-8")
        ).hexdigest()[:20]

        payload = {
            "question": question,
            "answer": answer,
            "citations": [item.model_dump(by_alias=True) for item in citations],
            "created_at": int(time.time()),
        }

        if self._redis is not None:
            try:
                await self._redis.setex(
                    f"cache:answer:{key}",
                    self._settings.semantic_cache_ttl_seconds,
                    json.dumps(payload, ensure_ascii=False),
                )
                await self._remember_recent(key, question, embedding)
            except Exception as exc:
                logger.warning("semantic cache write to redis failed: %s", exc)

        try:
            await asyncio.to_thread(
                self._upsert_vector, key, question, embedding
            )
        except Exception as exc:
            logger.warning("semantic cache write to chroma failed: %s", exc)

    def _upsert_vector(
        self, key: str, question: str, embedding: list[float]
    ) -> None:
        self._store.cache.upsert(
            ids=[key],
            embeddings=[embedding],
            documents=[question],
            metadatas=[
                {
                    "answer_key": key,
                    "question": question,
                    "created_at": time.time(),
                }
            ],
        )

    async def _remember_recent(
        self, key: str, question: str, embedding: list[float]
    ) -> None:
        assert self._redis is not None

        record = {
            "key": key,
            "question": question,
            "v": _encode(embedding),
            "ts": time.time(),
        }

        pipe = self._redis.pipeline(transaction=False)
        pipe.rpush("cache:recent", json.dumps(record, ensure_ascii=False))
        pipe.ltrim("cache:recent", -self._settings.cache_recent_limit, -1)
        pipe.expire("cache:recent", self._settings.semantic_cache_ttl_seconds)
        await pipe.execute()

    async def clear(self) -> None:
        if self._redis is not None:
            try:
                keys = [
                    key
                    async for key in self._redis.scan_iter(
                        match="cache:answer:*", count=200
                    )
                ]
                if keys:
                    await self._redis.delete(*keys)
                await self._redis.delete("cache:recent")
            except Exception as exc:
                logger.warning("semantic cache redis clear failed: %s", exc)

        try:
            await asyncio.to_thread(self._store.reset_cache)
        except Exception as exc:
            logger.warning("semantic cache chroma clear failed: %s", exc)

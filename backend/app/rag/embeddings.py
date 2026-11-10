from __future__ import annotations

import asyncio
import logging

from app.llm.ollama_client import OllamaGateway

logger = logging.getLogger(__name__)


class EmbeddingError(RuntimeError):
    pass


class Embedder:
    """nomic-embed-text with batching and a small retry budget."""

    def __init__(
        self,
        gateway: OllamaGateway,
        *,
        model: str,
        dimension: int,
        batch_size: int = 32,
    ) -> None:
        self._gateway = gateway
        self._model = model
        self._dimension = dimension
        self._batch_size = batch_size

    async def embed_query(self, text: str) -> list[float]:
        # nomic-embed-text is trained with asymmetric task prefixes.
        return await self.embed_one(f"search_query: {text}")

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self.embed_many([f"search_document: {text}" for text in texts])

    async def embed_one(self, text: str) -> list[float]:
        vectors = await self.embed_many([text])
        if not vectors:
            raise EmbeddingError("向量化失败：没有返回向量")
        vector = vectors[0]
        if len(vector) != self._dimension:
            raise EmbeddingError(
                f"向量维度不匹配：期望 {self._dimension}，实际 {len(vector)}"
            )
        return vector

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []

        for offset in range(0, len(texts), self._batch_size):
            batch = texts[offset : offset + self._batch_size]
            if not batch:
                continue

            vectors.extend(await self._embed_batch(batch))

        if len(vectors) != len(texts):
            raise EmbeddingError("向量化结果数量与文本数量不一致")

        return vectors

    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                result = await self._gateway.embed(batch)
                if len(result) != len(batch):
                    raise EmbeddingError("Ollama 返回的向量数量不匹配")
                return result
            except Exception as exc:  # connection reset / model loading
                last_error = exc
                logger.warning(
                    "embedding batch failed (attempt %s/3): %s", attempt + 1, exc
                )
                await asyncio.sleep(0.4 * (2**attempt))

        raise EmbeddingError(f"无法调用嵌入模型 {self._model}") from last_error

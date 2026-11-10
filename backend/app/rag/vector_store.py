from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.rag.chunking import Chunk

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class VectorHit:
    chunk_id: str
    doc_id: str
    doc_name: str
    page: int
    text: str
    similarity: float


class VectorStore:
    """Chroma persistent collections: documents + semantic_cache."""

    def __init__(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=str(path),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._documents = self._ensure_collection("documents")
        self._cache = self._ensure_collection("semantic_cache")
        logger.info("Chroma ready at %s", path)

    def _ensure_collection(self, name: str):
        # Chroma 1.x prefers `configuration`; older builds only read the
        # legacy `metadata` key. Try the modern form first.
        try:
            return self._client.get_or_create_collection(
                name=name,
                embedding_function=None,
                configuration={"hnsw": {"space": "cosine"}},
            )
        except Exception:
            return self._client.get_or_create_collection(
                name=name,
                embedding_function=None,
                metadata={"hnsw:space": "cosine"},
            )

    @property
    def documents(self):
        return self._documents

    @property
    def cache(self):
        return self._cache

    def reset_cache(self) -> None:
        try:
            self._client.delete_collection("semantic_cache")
        finally:
            self._cache = self._ensure_collection("semantic_cache")

    def count(self) -> int:
        return int(self._documents.count())

    async def add_chunks(
        self, chunks: list[Chunk], embeddings: list[list[float]]
    ) -> None:
        if not chunks:
            return
        await asyncio.to_thread(self._add_chunks_sync, chunks, embeddings)

    def _add_chunks_sync(
        self, chunks: list[Chunk], embeddings: list[list[float]]
    ) -> None:
        self._documents.add(
            ids=[chunk.chunk_id for chunk in chunks],
            embeddings=embeddings,
            documents=[chunk.text for chunk in chunks],
            metadatas=[
                {
                    "doc_id": chunk.doc_id,
                    "doc_name": chunk.doc_name,
                    "page": chunk.page,
                    "chunk_id": chunk.chunk_id,
                }
                for chunk in chunks
            ],
        )

    async def query(self, embedding: list[float], top_k: int) -> list[VectorHit]:
        return await asyncio.to_thread(self._query_sync, embedding, top_k)

    def _query_sync(self, embedding: list[float], top_k: int) -> list[VectorHit]:
        total = int(self._documents.count())
        if total == 0:
            return []

        result: dict[str, Any] = self._documents.query(
            query_embeddings=[embedding],
            n_results=min(top_k, total),
            include=["documents", "metadatas", "distances"],
        )

        ids = result.get("ids") or [[]]
        documents = result.get("documents") or [[]]
        metadatas = result.get("metadatas") or [[]]
        distances = result.get("distances") or [[]]

        hits: list[VectorHit] = []
        for index, chunk_id in enumerate(ids[0]):
            metadata = metadatas[0][index] or {}
            distance = float(distances[0][index])
            hits.append(
                VectorHit(
                    chunk_id=str(chunk_id),
                    doc_id=str(metadata.get("doc_id", "")),
                    doc_name=str(metadata.get("doc_name", "")),
                    page=int(metadata.get("page", 0)),
                    text=str(documents[0][index] or ""),
                    similarity=max(0.0, min(1.0, 1.0 - distance)),
                )
            )

        return hits

    async def delete_document(self, doc_id: str) -> None:
        await asyncio.to_thread(self._documents.delete, where={"doc_id": doc_id})

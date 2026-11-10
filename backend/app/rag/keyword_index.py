from __future__ import annotations

import logging
import os
import pickle
import threading
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

import jieba
import numpy as np
from rank_bm25 import BM25L

from app.rag.chunking import Chunk

logger = logging.getLogger(__name__)

STOPWORDS = {
    "的", "了", "和", "是", "在", "我", "有", "就", "不", "人", "都", "一",
    "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有",
    "看", "好", "自己", "这", "那", "与", "及", "或", "等", "中", "对", "为",
    "从", "被", "把", "而", "并且", "如何", "什么", "哪些", "怎么", "是否",
    "可以", "需要", "进行", "以及", "关于", "对于", "根据", "通过", "我们",
    "他们", "这个", "那个", "一个", "一下", "什么", "多少", "怎样",
}

@dataclass(slots=True)
class KeywordHit:
    chunk: Chunk
    score: float


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []

    for raw in jieba.lcut(text.lower()):
        token = raw.strip()
        if not token or token in STOPWORDS:
            continue
        if not any(ch.isalnum() or "\u4e00" <= ch <= "\u9fff" for ch in token):
            continue
        if len(token) == 1 and not ("\u4e00" <= token <= "\u9fff") and not token.isdigit():
            continue
        tokens.append(token)

    return tokens


class BM25Index:
    """In-memory jieba + rank_bm25 index with a pickle snapshot on disk."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._chunks: list[Chunk] = []
        self._tokenized: list[list[str]] = []
        self._bm25: BM25L | None = None
        self._lock = threading.RLock()

    def load(self) -> None:
        if not self._path.exists():
            return

        try:
            payload = pickle.loads(self._path.read_bytes())
        except Exception as exc:
            logger.warning("BM25 snapshot unreadable, starting empty: %s", exc)
            return

        if not isinstance(payload, dict) or payload.get("version") != 1:
            return

        try:
            self._chunks = [Chunk(**item) for item in payload["chunks"]]
            self._tokenized = payload["tokenized"]
            self._rebuild_bm25()
        except Exception as exc:
            logger.warning("BM25 snapshot invalid, starting empty: %s", exc)
            self._chunks = []
            self._tokenized = []
            self._bm25 = None

        logger.info("BM25 loaded: %s chunks", len(self._chunks))

    def count(self) -> int:
        with self._lock:
            return len(self._chunks)

    def add_chunks(self, chunks: list[Chunk]) -> None:
        if not chunks:
            return

        with self._lock:
            known = {chunk.chunk_id for chunk in self._chunks}
            self._chunks.extend(chunk for chunk in chunks if chunk.chunk_id not in known)
            self._rebuild_bm25()
            self._save()

    def remove_document(self, doc_id: str) -> None:
        with self._lock:
            self._chunks = [chunk for chunk in self._chunks if chunk.doc_id != doc_id]
            self._rebuild_bm25()
            self._save()

    def search(self, query: str, top_k: int) -> list[KeywordHit]:
        tokens = tokenize(query)
        if not tokens:
            return []

        with self._lock:
            bm25 = self._bm25
            chunks = self._chunks

            if bm25 is None or not chunks:
                return []

            scores = np.asarray(bm25.get_scores(tokens), dtype=float)

        ranked = np.argsort(scores)[::-1][:top_k]
        query_tokens = set(tokens)
        hits: list[KeywordHit] = []

        # BM25 can score a genuine match below zero on tiny corpora. Rank
        # order is what RRF consumes, so filter by lexical overlap instead of
        # by sign.
        for index in ranked:
            chunk = chunks[int(index)]
            if not query_tokens & set(tokenize(chunk.text)):
                continue
            hits.append(
                KeywordHit(chunk=chunk, score=float(scores[int(index)]))
            )

        return hits

    def coverage(self, query_tokens: Sequence[str], text: str) -> float:
        unique = set(query_tokens)
        if not unique:
            return 0.0

        chunk_tokens = set(tokenize(text))
        if not chunk_tokens:
            return 0.0

        return len(unique & chunk_tokens) / len(unique)

    def _rebuild_bm25(self) -> None:
        self._tokenized = [tokenize(chunk.text) for chunk in self._chunks]

        if not self._chunks or not any(self._tokenized):
            self._bm25 = None
            return

        # BM25L keeps scores stable when a term appears in most documents
        # (common with a single-document knowledge base).
        self._bm25 = BM25L(self._tokenized)

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "chunks": [asdict(chunk) for chunk in self._chunks],
            "tokenized": self._tokenized,
        }
        temporary = self._path.with_suffix(".tmp")

        try:
            temporary.write_bytes(pickle.dumps(payload))
            os.replace(temporary, self._path)
        except Exception as exc:
            logger.warning("could not persist BM25 snapshot: %s", exc)

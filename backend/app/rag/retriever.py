from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from app.config import Settings
from app.rag.embeddings import Embedder
from app.rag.fusion import Candidate, rrf_fuse
from app.rag.keyword_index import BM25Index, tokenize
from app.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RetrievalResult:
    candidates: list[Candidate]
    confident: bool
    top_similarity: float
    top_coverage: float
    reason: str


class Retriever:
    def __init__(
        self,
        settings: Settings,
        vector_store: VectorStore,
        keyword_index: BM25Index,
        embedder: Embedder,
    ) -> None:
        self._settings = settings
        self._vector = vector_store
        self._keyword = keyword_index
        self._embedder = embedder

    async def retrieve(self, question: str, embedding: list[float]) -> RetrievalResult:
        query_tokens = tokenize(question)

        vector_hits = await self._vector.query(embedding, self._settings.vector_top_k)
        keyword_hits = await asyncio.to_thread(
            self._keyword.search, question, self._settings.keyword_top_k
        )

        vector_candidates = [
            Candidate(
                chunk_id=hit.chunk_id,
                doc_id=hit.doc_id,
                doc_name=hit.doc_name,
                page=hit.page,
                text=hit.text,
                vector_score=hit.similarity,
                score=hit.similarity,
            )
            for hit in vector_hits
        ]

        keyword_candidates: list[Candidate] = []
        for hit in keyword_hits:
            coverage = self._keyword.coverage(query_tokens, hit.chunk.text)
            keyword_candidates.append(
                Candidate(
                    chunk_id=hit.chunk.chunk_id,
                    doc_id=hit.chunk.doc_id,
                    doc_name=hit.chunk.doc_name,
                    page=hit.chunk.page,
                    text=hit.chunk.text,
                    keyword_score=hit.score,
                    score=min(0.9, coverage * 0.9),
                )
            )

        fused = rrf_fuse(
            vector_candidates,
            keyword_candidates,
            k=self._settings.rrf_k,
            top_n=self._settings.fusion_top_k,
        )

        top_similarity = max((item.vector_score for item in fused), default=0.0)
        top_coverage = max(
            (
                self._keyword.coverage(query_tokens, item.text)
                for item in fused[:3]
            ),
            default=0.0,
        )

        # Lexical overlap is the stronger signal on a small corpus: a chunk
        # can score high on cosine while sharing no content words. Prefer the
        # lexically covered candidates; only fall back to cosine when no chunk
        # covers the query at all (e.g. a pure paraphrase).
        covered = [
            item
            for item in fused
            if self._keyword.coverage(query_tokens, item.text)
            >= self._settings.evidence_coverage
        ]

        if covered:
            evidence = covered
        else:
            evidence = [
                item
                for item in fused
                if item.vector_score >= self._settings.evidence_similarity
            ]
            if not evidence:
                evidence = fused[:1]

        if not fused:
            reason = "no_hits"
        elif (
            top_similarity >= self._settings.min_context_similarity
            or top_coverage >= self._settings.min_keyword_coverage
        ):
            reason = "ok"
        else:
            reason = "low_score"

        confident = reason == "ok"

        logger.info(
            "retrieval: vector=%s keyword=%s fused=%s kept=%s top_sim=%.3f top_cov=%.2f (%s)",
            len(vector_candidates),
            len(keyword_candidates),
            len(fused),
            len(evidence),
            top_similarity,
            top_coverage,
            reason,
        )

        return RetrievalResult(
            candidates=evidence,
            confident=confident,
            top_similarity=top_similarity,
            top_coverage=top_coverage,
            reason=reason,
        )

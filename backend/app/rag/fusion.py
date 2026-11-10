from __future__ import annotations

from dataclasses import dataclass
from collections.abc import Sequence


@dataclass(slots=True)
class Candidate:
    chunk_id: str
    doc_id: str
    doc_name: str
    page: int
    text: str
    vector_score: float = 0.0
    keyword_score: float = 0.0
    score: float = 0.0
    fused_score: float = 0.0


def rrf_fuse(
    vector_hits: Sequence[Candidate],
    keyword_hits: Sequence[Candidate],
    *,
    k: int = 60,
    top_n: int = 6,
) -> list[Candidate]:
    """
    Reciprocal Rank Fusion.

    Vector cosine scores and BM25 scores live on different scales, so only
    ranks are combined: score = Σ 1 / (k + rank).
    """
    merged: dict[str, Candidate] = {}
    scores: dict[str, float] = {}

    for rank, hit in enumerate(vector_hits, start=1):
        merged.setdefault(hit.chunk_id, hit)
        scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + 1.0 / (k + rank)

    for rank, hit in enumerate(keyword_hits, start=1):
        existing = merged.get(hit.chunk_id)
        if existing is None:
            merged[hit.chunk_id] = hit
            scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + 1.0 / (k + rank)
            continue

        existing.keyword_score = max(existing.keyword_score, hit.keyword_score)
        existing.score = max(existing.score, hit.score)
        scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + 1.0 / (k + rank)

    for chunk_id, total in scores.items():
        merged[chunk_id].fused_score = total

    ordered = sorted(
        merged.values(),
        key=lambda item: (item.fused_score, item.score),
        reverse=True,
    )
    return ordered[:top_n]

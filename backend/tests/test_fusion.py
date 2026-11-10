from app.rag.fusion import Candidate, rrf_fuse


def make(chunk_id: str, *, vector: float = 0.0, keyword: float = 0.0) -> Candidate:
    return Candidate(
        chunk_id=chunk_id,
        doc_id="doc",
        doc_name="制度.pdf",
        page=1,
        text=f"text-{chunk_id}",
        vector_score=vector,
        keyword_score=keyword,
        score=max(vector, keyword),
    )


def test_rrf_prefers_document_ranked_by_both_lists():
    vector = [make("a", vector=0.91), make("b", vector=0.88)]
    keyword = [make("b", keyword=7.2), make("c", keyword=6.1)]

    fused = rrf_fuse(vector, keyword, k=60, top_n=3)

    assert [item.chunk_id for item in fused] == ["b", "a", "c"]
    assert fused[0].keyword_score == 7.2
    assert fused[0].vector_score == 0.88


def test_rrf_respects_top_n_and_empty_input():
    assert rrf_fuse([], [], k=60, top_n=6) == []

    fused = rrf_fuse(
        [make("a"), make("b"), make("c")],
        [],
        k=60,
        top_n=2,
    )
    assert len(fused) == 2

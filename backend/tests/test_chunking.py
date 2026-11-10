from app.rag.chunking import chunk_pages


def test_chunks_respect_size_and_page():
    text = "第一条 员工应当遵守公司制度。" * 80
    chunks = chunk_pages(
        [(3, text)],
        doc_id="doc1",
        doc_name="制度.pdf",
        size=600,
        overlap=120,
    )

    assert len(chunks) > 1
    assert all(len(chunk.text) <= 600 for chunk in chunks)
    assert all(chunk.page == 3 for chunk in chunks)
    assert len({chunk.chunk_id for chunk in chunks}) == len(chunks)


def test_chunk_prefers_sentence_boundary():
    text = "甲" * 550 + "。" + "乙" * 500
    chunks = chunk_pages(
        [(1, text)],
        doc_id="doc2",
        doc_name="长文.pdf",
        size=600,
        overlap=120,
    )

    assert chunks[0].text.endswith("。")
    assert len(chunks[0].text) == 551


def test_short_page_is_kept_as_one_chunk():
    chunks = chunk_pages(
        [(1, "短文本内容")],
        doc_id="doc3",
        doc_name="短.pdf",
        size=600,
        overlap=120,
    )

    assert len(chunks) == 1
    assert chunks[0].text == "短文本内容"


def test_empty_pages_are_skipped():
    chunks = chunk_pages(
        [(1, "   \n  "), (2, "")],
        doc_id="doc4",
        doc_name="空.pdf",
        size=600,
        overlap=120,
    )

    assert chunks == []

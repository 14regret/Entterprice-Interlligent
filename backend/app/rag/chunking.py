from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

SENTENCE_ENDINGS = frozenset("。！？!?；;\n")
_HORIZONTAL_SPACE = re.compile(r"[ \t\u3000]+")
_CJK_GAP = re.compile(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])")
_MANY_BLANK_LINES = re.compile(r"\n{3,}")
_PAGE_NOISE = re.compile(r"^第?\d+页?$")


@dataclass(slots=True)
class Chunk:
    id: str
    doc_id: str
    doc_name: str
    page: int
    chunk_id: str
    text: str


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _HORIZONTAL_SPACE.sub(" ", text)
    # PDF extraction often inserts a space per glyph; CJK has no word spaces.
    text = _CJK_GAP.sub("", text)
    text = _MANY_BLANK_LINES.sub("\n\n", text)
    return text.strip()


def _find_break(text: str, start: int, end: int) -> int:
    """Prefer the last sentence boundary in the final two thirds of a window."""
    floor = start + max(1, (end - start) // 3)
    for index in range(end - 1, floor - 1, -1):
        if text[index] in SENTENCE_ENDINGS:
            return index + 1
    return end


def _is_page_noise(text: str) -> bool:
    compact = text.replace(" ", "").strip()
    if not compact:
        return True
    if compact.isdigit():
        return True
    if _PAGE_NOISE.fullmatch(compact):
        return True
    return not any(ch.isalnum() or "\u4e00" <= ch <= "\u9fff" for ch in compact)


def chunk_pages(
    pages: Iterable[tuple[int, str]],
    *,
    doc_id: str,
    doc_name: str,
    size: int = 600,
    overlap: int = 120,
) -> list[Chunk]:
    """Slide a character window per page, backing off to sentence boundaries."""
    size = max(120, size)
    overlap = min(max(0, overlap), size // 2)

    chunks: list[Chunk] = []

    for page_number, raw_text in pages:
        text = normalize_text(raw_text)
        if not text:
            continue

        start = 0
        local_index = 0

        while start < len(text):
            end = min(start + size, len(text))
            if end < len(text):
                end = _find_break(text, start, end)

            piece = text[start:end].strip()
            if len(piece) >= 12 or (len(piece) >= 4 and not _is_page_noise(piece)):
                chunk_id = f"{doc_id}:p{page_number}:c{local_index}"
                chunks.append(
                    Chunk(
                        id=chunk_id,
                        doc_id=doc_id,
                        doc_name=doc_name,
                        page=page_number,
                        chunk_id=chunk_id,
                        text=piece,
                    )
                )
                local_index += 1

            if end >= len(text):
                break

            start = max(end - overlap, start + 1)

    return chunks

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from pathlib import Path

from pypdf import PdfReader

from app.config import Settings
from app.infra.semantic_cache import SemanticCache
from app.rag.chunking import chunk_pages
from app.rag.embeddings import Embedder
from app.rag.keyword_index import BM25Index
from app.rag.vector_store import VectorStore
from app.schemas import DocumentMeta, DocumentStatus
from app.services.registry import DocumentRegistry

logger = logging.getLogger(__name__)


class DocumentNotFound(RuntimeError):
    pass


class DocumentBusy(RuntimeError):
    pass


class IngestError(RuntimeError):
    pass


def parse_pdf(path: Path) -> tuple[int, list[tuple[int, str]]]:
    """Return (total pages, [(page_number, text), ...]) for pages with text."""
    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        raise IngestError("PDF 无法解析，文件可能已损坏") from exc

    if reader.is_encrypted:
        try:
            if reader.decrypt("") == 0:
                raise IngestError("PDF 已加密，请先解除密码再上传")
        except IngestError:
            raise
        except Exception as exc:
            raise IngestError("PDF 已加密，请先解除密码再上传") from exc

    total_pages = len(reader.pages)
    pages: list[tuple[int, str]] = []

    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""

        if text.strip():
            pages.append((index, text))

    return total_pages, pages


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class IngestService:
    def __init__(
        self,
        settings: Settings,
        registry: DocumentRegistry,
        vector_store: VectorStore,
        keyword_index: BM25Index,
        embedder: Embedder,
        cache: SemanticCache,
    ) -> None:
        self._settings = settings
        self._registry = registry
        self._vector = vector_store
        self._keyword = keyword_index
        self._embedder = embedder
        self._cache = cache
        self._tasks: set[asyncio.Task[None]] = set()
        # One document at a time: a local 1.5B box should not run parallel
        # embedding batches against the same Ollama process.
        self._gate = asyncio.Semaphore(1)

    async def create(self, filename: str, data: bytes) -> DocumentMeta:
        doc_id = uuid.uuid4().hex
        path = self._settings.upload_dir / f"{doc_id}.pdf"
        await asyncio.to_thread(path.write_bytes, data)

        meta = DocumentMeta(
            id=doc_id,
            name=Path(filename).name,
            pages=0,
            chunks=0,
            size_bytes=len(data),
            status=DocumentStatus.PROCESSING,
            uploaded_at=_now_iso(),
        )
        self._registry.upsert(meta)

        task = asyncio.create_task(self._ingest(doc_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

        return meta

    async def _ingest(self, doc_id: str) -> None:
        async with self._gate:
            meta = self._registry.get(doc_id)
            if meta is None:
                return

            path = self._settings.upload_dir / f"{doc_id}.pdf"

            try:
                total_pages, pages = await asyncio.to_thread(parse_pdf, path)
                meta.pages = total_pages

                if not pages:
                    raise IngestError("PDF 没有可提取的文本层（可能是扫描件）")

                chunks = chunk_pages(
                    pages,
                    doc_id=doc_id,
                    doc_name=meta.name,
                    size=self._settings.chunk_size,
                    overlap=self._settings.chunk_overlap,
                )
                if not chunks:
                    raise IngestError("没有可索引的文本")

                embeddings = await self._embedder.embed_documents(
                    [chunk.text for chunk in chunks]
                )
                await self._vector.add_chunks(chunks, embeddings)
                await asyncio.to_thread(self._keyword.add_chunks, chunks)

                meta.status = DocumentStatus.READY
                meta.chunks = len(chunks)
                meta.error = None
                self._registry.upsert(meta)

                # A new source makes every cached answer potentially stale.
                await self._cache.clear()

                logger.info(
                    "ingested %s: %s pages, %s chunks",
                    meta.name,
                    total_pages,
                    len(chunks),
                )
            except Exception as exc:
                logger.exception("ingest failed for %s", doc_id)
                meta.status = DocumentStatus.FAILED
                meta.error = str(exc)[:240]
                self._registry.upsert(meta)
                await self._cleanup(doc_id)

    async def _cleanup(self, doc_id: str) -> None:
        try:
            await self._vector.delete_document(doc_id)
        except Exception:
            pass

        try:
            await asyncio.to_thread(self._keyword.remove_document, doc_id)
        except Exception:
            pass

    async def delete(self, doc_id: str) -> None:
        meta = self._registry.get(doc_id)
        if meta is None:
            raise DocumentNotFound("文档不存在")
        if meta.status is DocumentStatus.PROCESSING:
            raise DocumentBusy("文档正在解析，请稍后再删除")

        await self._vector.delete_document(doc_id)
        await asyncio.to_thread(self._keyword.remove_document, doc_id)

        path = self._settings.upload_dir / f"{doc_id}.pdf"
        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("could not delete upload file: %s", exc)

        self._registry.remove(doc_id)
        await self._cache.clear()

    async def shutdown(self) -> None:
        tasks = list(self._tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

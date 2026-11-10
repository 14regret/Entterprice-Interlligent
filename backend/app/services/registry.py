from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from app.schemas import DocumentMeta, DocumentStatus

logger = logging.getLogger(__name__)


class DocumentRegistry:
    """Small JSON registry so index status survives a restart."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._items: dict[str, DocumentMeta] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return

        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("document registry unreadable: %s", exc)
            return

        if not isinstance(payload, list):
            return

        for item in payload:
            try:
                meta = DocumentMeta.model_validate(item)
            except Exception:
                continue
            self._items[meta.id] = meta

        logger.info("document registry loaded: %s entries", len(self._items))

    def all(self) -> list[DocumentMeta]:
        return sorted(
            self._items.values(),
            key=lambda item: item.uploaded_at,
            reverse=True,
        )

    def get(self, doc_id: str) -> DocumentMeta | None:
        return self._items.get(doc_id)

    def upsert(self, meta: DocumentMeta) -> None:
        self._items[meta.id] = meta
        self._persist()

    def remove(self, doc_id: str) -> None:
        self._items.pop(doc_id, None)
        self._persist()

    def fail_incomplete(self, reason: str) -> None:
        changed = False

        for meta in self._items.values():
            if meta.status is DocumentStatus.PROCESSING:
                meta.status = DocumentStatus.FAILED
                meta.error = reason
                changed = True

        if changed:
            self._persist()

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = [
            meta.model_dump(mode="json") for meta in self._items.values()
        ]
        temporary = self._path.with_suffix(".tmp")

        try:
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            os.replace(temporary, self._path)
        except Exception as exc:
            logger.warning("document registry write failed: %s", exc)

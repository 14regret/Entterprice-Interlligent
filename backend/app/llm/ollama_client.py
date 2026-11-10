from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from ollama import AsyncClient

logger = logging.getLogger(__name__)


class ModelUnavailable(RuntimeError):
    pass


DEFAULT_OPTIONS: dict[str, Any] = {
    "temperature": 0.0,
    "top_p": 0.8,
    "num_predict": 512,
    "num_ctx": 8192,
    "repeat_penalty": 1.05,
}


class OllamaGateway:
    """Thin async wrapper around the local Ollama daemon."""

    def __init__(
        self,
        base_url: str,
        *,
        chat_model: str,
        embed_model: str,
        timeout: float = 180.0,
    ) -> None:
        self._client = AsyncClient(host=base_url, timeout=timeout)
        self._chat_model = chat_model
        self._embed_model = embed_model

    async def list_models(self) -> list[str]:
        response = await self._client.list()
        return [str(model.model) for model in response.models]

    async def health(self) -> tuple[bool, str]:
        try:
            models = await asyncio.wait_for(self.list_models(), timeout=3.0)
        except Exception as exc:
            logger.warning("ollama health check failed: %s", exc)
            return False, self._chat_model

        if self._chat_model in models:
            return True, self._chat_model

        base = self._chat_model.split(":", 1)[0]
        for name in models:
            if name.split(":", 1)[0] == base:
                return True, name

        # The daemon is reachable; Ollama will pull a missing model on demand.
        return True, self._chat_model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embed(model=self._embed_model, input=texts)
        return [list(vector) for vector in response.embeddings]

    async def chat_stream(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        try:
            stream = await self._client.chat(
                model=self._chat_model,
                messages=messages,
                stream=True,
                options=DEFAULT_OPTIONS,
            )
        except Exception as exc:
            raise ModelUnavailable("无法连接本地 Ollama 生成模型") from exc

        async for part in stream:
            message = getattr(part, "message", None)
            content = getattr(message, "content", "") or ""
            if content:
                yield content

    async def close(self) -> None:
        inner = getattr(self._client, "_client", None)
        if inner is not None:
            try:
                await inner.aclose()
            except Exception:
                pass

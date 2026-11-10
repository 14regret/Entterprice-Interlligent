from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.core.container import Services
from app.core.logging import configure_logging
from app.infra.memory import SessionMemory
from app.infra.rate_limit import RateLimiter
from app.infra.redis_pool import RedisStore
from app.infra.semantic_cache import SemanticCache
from app.llm.ollama_client import OllamaGateway
from app.rag.embeddings import Embedder
from app.rag.keyword_index import BM25Index
from app.rag.retriever import Retriever
from app.rag.vector_store import VectorStore
from app.services.chat import ChatService
from app.services.ingest import IngestService
from app.services.registry import DocumentRegistry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.ensure_dirs()
    configure_logging()

    logger.info("Starting %s", settings.app_name)

    redis_store = RedisStore(settings.redis_url)
    try:
        await redis_store.connect()
    except Exception as exc:
        logger.warning(
            "Redis unavailable (%s); cache, memory and rate limit degrade to no-op",
            exc,
        )

    redis = redis_store.client if redis_store.available else None

    vector_store = VectorStore(settings.chroma_dir)

    keyword_index = BM25Index(settings.bm25_path)
    keyword_index.load()

    gateway = OllamaGateway(
        settings.ollama_base_url,
        chat_model=settings.chat_model,
        embed_model=settings.embed_model,
        timeout=float(settings.generation_timeout_seconds),
    )
    embedder = Embedder(
        gateway,
        model=settings.embed_model,
        dimension=settings.embed_dim,
    )

    cache = SemanticCache(settings, redis, vector_store)
    memory = SessionMemory(
        redis,
        ttl_seconds=settings.session_ttl_seconds,
        max_turns=settings.session_max_turns,
    )
    limiter = RateLimiter(redis, settings.rate_limit_per_minute)

    registry = DocumentRegistry(settings.registry_path)
    registry.fail_incomplete("服务重启时索引未完成，请重新上传")

    ingest = IngestService(
        settings,
        registry,
        vector_store,
        keyword_index,
        embedder,
        cache,
    )
    retriever = Retriever(settings, vector_store, keyword_index, embedder)
    chat = ChatService(settings, gateway, embedder, retriever, cache, memory)

    app.state.services = Services(
        settings=settings,
        redis=redis_store,
        gateway=gateway,
        embedder=embedder,
        vector_store=vector_store,
        keyword_index=keyword_index,
        cache=cache,
        memory=memory,
        limiter=limiter,
        registry=registry,
        ingest=ingest,
        chat=chat,
    )

    logger.info(
        "Ready: %s documents, %s chunks, model=%s",
        len(registry.all()),
        keyword_index.count(),
        settings.chat_model,
    )

    try:
        yield
    finally:
        logger.info("Shutting down")
        await ingest.shutdown()
        await gateway.close()
        await redis_store.close()

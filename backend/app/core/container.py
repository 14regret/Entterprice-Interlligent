from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings
from app.infra.memory import SessionMemory
from app.infra.rate_limit import RateLimiter
from app.infra.redis_pool import RedisStore
from app.infra.semantic_cache import SemanticCache
from app.llm.ollama_client import OllamaGateway
from app.rag.embeddings import Embedder
from app.rag.keyword_index import BM25Index
from app.rag.vector_store import VectorStore
from app.services.chat import ChatService
from app.services.ingest import IngestService
from app.services.registry import DocumentRegistry


@dataclass(slots=True)
class Services:
    settings: Settings
    redis: RedisStore
    gateway: OllamaGateway
    embedder: Embedder
    vector_store: VectorStore
    keyword_index: BM25Index
    cache: SemanticCache
    memory: SessionMemory
    limiter: RateLimiter
    registry: DocumentRegistry
    ingest: IngestService
    chat: ChatService

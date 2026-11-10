from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration, read from backend/.env when present."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Nexus 智询"
    ollama_base_url: str = "http://127.0.0.1:11434"
    chat_model: str = "qwen2:1.5b"
    embed_model: str = "nomic-embed-text"
    embed_dim: int = 768

    redis_url: str = "redis://127.0.0.1:6379/0"
    session_ttl_seconds: int = 1800
    session_max_turns: int = 6
    rate_limit_per_minute: int = 30
    semantic_cache_threshold: float = 0.92
    semantic_cache_ttl_seconds: int = 86400
    cache_recent_limit: int = 100

    # nomic-embed-text collapses some short Chinese questions to nearly the
    # same vector (observed 0.9973 for unrelated questions). A cosine-only
    # cache therefore needs a lexical overlap guard.
    cache_min_question_overlap: float = 0.35

    data_dir: Path = Path("./data")
    upload_dir: Path = Path("./data/uploads")
    chroma_dir: Path = Path("./data/chroma")
    bm25_path: Path = Path("./data/index/bm25.pkl")

    chunk_size: int = 600
    chunk_overlap: int = 120
    vector_top_k: int = 8
    keyword_top_k: int = 8
    fusion_top_k: int = 6
    rrf_k: int = 60

    # Retrieval is also the first anti-hallucination gate: without enough
    # lexical or semantic overlap we refuse before the model is called.
    min_context_similarity: float = 0.60
    min_keyword_coverage: float = 0.55

    # Evidence margin filter: lexical evidence wins over a noisy cosine.
    evidence_similarity: float = 0.65
    evidence_coverage: float = 0.30

    max_upload_mb: int = 20
    generation_timeout_seconds: int = 180

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    def model_post_init(self, __context: object) -> None:
        # .env paths are written relative to backend/ for a readable config.
        for name in ("data_dir", "upload_dir", "chroma_dir", "bm25_path"):
            value: Path = getattr(self, name)
            if not value.is_absolute():
                setattr(self, name, (BACKEND_DIR / value).resolve())

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def index_dir(self) -> Path:
        return self.bm25_path.parent

    @property
    def registry_path(self) -> Path:
        return self.index_dir / "documents.json"

    def ensure_dirs(self) -> None:
        for path in (self.data_dir, self.upload_dir, self.chroma_dir, self.index_dir):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

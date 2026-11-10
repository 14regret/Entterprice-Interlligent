from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, documents, system
from app.config import get_settings
from app.core.lifespan import lifespan


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=f"{settings.app_name} API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Retry-After"],
    )

    app.include_router(chat.router, prefix="/api")
    app.include_router(documents.router, prefix="/api")
    app.include_router(system.router, prefix="/api")

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"name": settings.app_name, "docs": "/api/docs"}

    return app


app = create_app()

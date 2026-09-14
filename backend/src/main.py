"""Fabrica da aplicacao FastAPI (composition root)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.router import api_router
from modules.vocabulary.infrastructure.sentence_validator import SentenceValidatorService
from shared.api.error_handlers import register_error_handlers
from shared.config import Settings, get_settings
from shared.database import dispose_engine
from version import __version__

# Importado pelo efeito colateral de registrar todos os models no metadata do SQLAlchemy.
import orm_registry  # noqa: F401,E402  isort:skip


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Carrega o modelo spaCy uma unica vez. Falha ruidosamente se ausente.
    _app.state.sentence_validator = SentenceValidatorService.load()
    yield
    await dispose_engine()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        debug=settings.debug,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)

    return app


app = create_app()

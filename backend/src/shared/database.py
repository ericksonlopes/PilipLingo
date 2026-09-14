"""Infraestrutura de persistencia: engine async, sessao e Base declarativa."""

from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

from sqlalchemy import MetaData, event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from shared.config import Settings, get_settings

# Nomes deterministas de constraints: obrigatorio para o Alembic conseguir
# alterar/remover constraints no SQLite (batch mode).
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base declarativa unica da aplicacao (metadata usada pelo Alembic)."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def ensure_sqlite_dir(settings: Settings | None = None) -> None:
    """Cria o diretorio do arquivo SQLite antes de abrir a conexao."""
    settings = settings or get_settings()
    sqlite_path = settings.sqlite_path
    if sqlite_path is not None:
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)


def create_engine(settings: Settings | None = None) -> AsyncEngine:
    settings = settings or get_settings()
    ensure_sqlite_dir(settings)

    connect_args: dict[str, Any] = {}
    if settings.is_sqlite:
        connect_args["timeout"] = 30

    engine = create_async_engine(
        settings.database_url,
        echo=settings.database_echo,
        future=True,
        connect_args=connect_args,
    )

    if settings.is_sqlite:

        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


@lru_cache
def get_engine() -> AsyncEngine:
    """Engine unica por processo."""
    return create_engine()


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        expire_on_commit=False,
        autoflush=False,
    )


async def get_session() -> AsyncIterator[AsyncSession]:
    """Dependencia FastAPI: uma sessao (e uma transacao) por request.

    Commit no fim do request quando nada falhou, rollback em caso de excecao.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()


async def dispose_engine() -> None:
    """Fecha o pool de conexoes (shutdown da aplicacao)."""
    engine = get_engine()
    await engine.dispose()

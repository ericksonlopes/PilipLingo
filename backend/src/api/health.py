"""Healthcheck: valida que a aplicacao responde e que o banco esta acessivel."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from shared.api.dependencies import SessionDep, SettingsDep
from version import __version__

router = APIRouter(tags=["health"])


@router.get("/health", summary="Status da API e do banco")
async def health(session: SessionDep, settings: SettingsDep) -> dict[str, object]:
    await session.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": __version__,
        "environment": settings.environment,
        "database": "up",
    }

"""Healthcheck: validates that the application responds and the database is accessible."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from shared.api.dependencies import SessionDep, SettingsDep
from version import __version__

router = APIRouter(tags=["health"])


@router.get("/health", summary="API and database status")
async def health(session: SessionDep, settings: SettingsDep) -> dict[str, object]:
    await session.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": __version__,
        "environment": settings.environment,
        "database": "up",
    }

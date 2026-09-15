"""Conversion between ORM model and domain entity for users slice."""

from __future__ import annotations

from datetime import UTC, datetime

from modules.users.domain.entities import User
from modules.users.infrastructure.models import UserModel


def _as_utc(value: datetime) -> datetime:
    """SQLite does not store timezone: re-attach UTC when naive."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def to_domain(model: UserModel) -> User:
    return User(
        id=model.id,
        username=model.username,
        password_hash=model.password_hash,
        created_at=_as_utc(model.created_at),
    )


def to_model(user: User) -> UserModel:
    return UserModel(
        id=user.id,
        username=user.username,
        password_hash=user.password_hash,
        created_at=user.created_at,
    )

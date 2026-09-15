"""Entities for users domain. No framework or ORM dependency."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from shared.errors import ValidationError

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 40
MIN_PASSWORD_LENGTH = 6
MAX_PASSWORD_LENGTH = 128

__all__ = [
    "MAX_PASSWORD_LENGTH",
    "MAX_USERNAME_LENGTH",
    "MIN_PASSWORD_LENGTH",
    "MIN_USERNAME_LENGTH",
    "User",
    "normalize_username",
    "validate_password",
]


def normalize_username(value: str) -> str:
    """User uniqueness key (case-insensitive, trimmed)."""
    text = (value or "").strip()
    if len(text) < MIN_USERNAME_LENGTH:
        raise ValidationError(f"Username must have at least {MIN_USERNAME_LENGTH} characters.")
    if len(text) > MAX_USERNAME_LENGTH:
        raise ValidationError(f"Username exceeds {MAX_USERNAME_LENGTH} characters.")
    return text.casefold()


def validate_password(value: str) -> str:
    """Ensures a minimum password length before generating hash."""
    if value is None or len(value) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Password must have at least {MIN_PASSWORD_LENGTH} characters.")
    if len(value) > MAX_PASSWORD_LENGTH:
        raise ValidationError(f"Password exceeds {MAX_PASSWORD_LENGTH} characters.")
    return value


@dataclass(slots=True)
class User:
    """Registered user entity. `password_hash` never leaks outside HTTP boundary."""

    id: UUID
    username: str
    password_hash: str
    created_at: datetime

    @classmethod
    def create(cls, *, username: str, password_hash: str) -> User:
        """Factory that normalizes username and enforces basic invariants."""
        return cls(
            id=uuid4(),
            username=normalize_username(username),
            password_hash=password_hash,
            created_at=datetime.now(UTC),
        )

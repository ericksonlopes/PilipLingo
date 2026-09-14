"""Entidades do dominio users. Sem dependencia de framework ou ORM."""

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
    """Chave de unicidade do usuario (case-insensitive, sem espacos nas pontas)."""
    text = (value or "").strip()
    if len(text) < MIN_USERNAME_LENGTH:
        raise ValidationError(f"O usuario precisa de ao menos {MIN_USERNAME_LENGTH} caracteres.")
    if len(text) > MAX_USERNAME_LENGTH:
        raise ValidationError(f"O usuario excede {MAX_USERNAME_LENGTH} caracteres.")
    return text.casefold()


def validate_password(value: str) -> str:
    """Garante um minimo de tamanho antes de gerar o hash."""
    if value is None or len(value) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"A senha precisa de ao menos {MIN_PASSWORD_LENGTH} caracteres.")
    if len(value) > MAX_PASSWORD_LENGTH:
        raise ValidationError(f"A senha excede {MAX_PASSWORD_LENGTH} caracteres.")
    return value


@dataclass(slots=True)
class User:
    """Um usuario cadastrado. `password_hash` nunca vaza para fora da borda HTTP."""

    id: UUID
    username: str
    password_hash: str
    created_at: datetime

    @classmethod
    def create(cls, *, username: str, password_hash: str) -> User:
        """Fabrica que normaliza o nome e garante as invariantes basicas."""
        return cls(
            id=uuid4(),
            username=normalize_username(username),
            password_hash=password_hash,
            created_at=datetime.now(UTC),
        )

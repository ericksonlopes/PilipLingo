"""Erros especificos da fatia users."""

from __future__ import annotations

from shared.errors import ConflictError, UnauthorizedError


class UsernameAlreadyTaken(ConflictError):
    """Ja existe um usuario com esse nome."""

    code = "username_taken"


class InvalidCredentials(UnauthorizedError):
    """Usuario ou senha incorretos."""

    code = "invalid_credentials"


class InvalidToken(UnauthorizedError):
    """Token ausente, expirado ou malformado."""

    code = "invalid_token"

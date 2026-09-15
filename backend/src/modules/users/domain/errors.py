"""Specific errors for users slice."""

from __future__ import annotations

from shared.errors import ConflictError, UnauthorizedError


class UsernameAlreadyTaken(ConflictError):
    """User with this username already exists."""

    code = "username_taken"


class InvalidCredentials(UnauthorizedError):
    """Incorrect username or password."""

    code = "invalid_credentials"


class InvalidToken(UnauthorizedError):
    """Missing, expired, or malformed token."""

    code = "invalid_token"

"""Shared domain errors. Independent of HTTP and framework."""

from __future__ import annotations


class DomainError(Exception):
    """Base for all business rule errors."""

    code = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(DomainError):
    """Input data invalid according to domain rules."""

    code = "validation_error"


class NotFoundError(DomainError):
    """Resource does not exist."""

    code = "not_found"


class ConflictError(DomainError):
    """Operation violates a uniqueness/state invariant."""

    code = "conflict"


class UnavailableError(DomainError):
    """External dependency unavailable or unconfigured."""

    code = "unavailable"


class UnauthorizedError(DomainError):
    """Missing or invalid credentials."""

    code = "unauthorized"

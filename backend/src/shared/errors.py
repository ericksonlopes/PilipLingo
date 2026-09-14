"""Erros de dominio compartilhados. Independentes de HTTP e de framework."""

from __future__ import annotations


class DomainError(Exception):
    """Base de todos os erros de regra de negocio."""

    code = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ValidationError(DomainError):
    """Dado de entrada invalido segundo as regras do dominio."""

    code = "validation_error"


class NotFoundError(DomainError):
    """Recurso inexistente."""

    code = "not_found"


class ConflictError(DomainError):
    """Operacao viola uma invariante de unicidade/estado."""

    code = "conflict"


class UnavailableError(DomainError):
    """Dependencia externa indisponivel ou nao configurada."""

    code = "unavailable"


class UnauthorizedError(DomainError):
    """Credenciais ausentes ou invalidas."""

    code = "unauthorized"

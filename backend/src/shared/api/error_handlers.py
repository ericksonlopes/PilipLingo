"""Traducao de erros de dominio para respostas HTTP.

Mantem o dominio livre de qualquer conhecimento sobre HTTP: apenas esta camada
sabe qual status code corresponde a cada erro.
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from shared.errors import (
    ConflictError,
    DomainError,
    NotFoundError,
    UnauthorizedError,
    UnavailableError,
    ValidationError,
)

# Starlette renomeou 422 (Unprocessable Entity -> Unprocessable Content).
HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)

_STATUS_BY_ERROR: dict[type[DomainError], int] = {
    ValidationError: HTTP_422,
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ConflictError: status.HTTP_409_CONFLICT,
    UnauthorizedError: status.HTTP_401_UNAUTHORIZED,
    UnavailableError: status.HTTP_503_SERVICE_UNAVAILABLE,
}


def _status_for(error: DomainError) -> int:
    for error_type, http_status in _STATUS_BY_ERROR.items():
        if isinstance(error, error_type):
            return http_status
    return status.HTTP_400_BAD_REQUEST


async def domain_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, DomainError):  # pragma: no cover - contrato do handler
        raise exc
    return JSONResponse(
        status_code=_status_for(exc),
        content={"error": {"code": exc.code, "message": exc.message}},
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)

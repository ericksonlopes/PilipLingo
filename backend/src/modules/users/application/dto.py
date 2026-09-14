"""Objetos de transporte entre a borda HTTP e os casos de uso da fatia users."""

from __future__ import annotations

from dataclasses import dataclass

from modules.users.domain.entities import User


@dataclass(frozen=True, slots=True)
class RegisterUserCommand:
    username: str
    password: str


@dataclass(frozen=True, slots=True)
class AuthenticateUserCommand:
    username: str
    password: str


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """Usuario autenticado + token de acesso recem emitido."""

    user: User
    access_token: str

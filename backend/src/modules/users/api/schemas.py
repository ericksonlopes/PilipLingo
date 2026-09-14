"""Contratos HTTP (Pydantic) da fatia users."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from modules.users.domain.entities import (
    MAX_PASSWORD_LENGTH,
    MAX_USERNAME_LENGTH,
    MIN_PASSWORD_LENGTH,
    MIN_USERNAME_LENGTH,
    User,
)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(
        min_length=MIN_USERNAME_LENGTH,
        max_length=MAX_USERNAME_LENGTH,
        examples=["maria"],
    )
    password: str = Field(
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
        examples=["senha123"],
    )


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(min_length=1, max_length=MAX_USERNAME_LENGTH, examples=["maria"])
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH, examples=["senha123"])


class UserResponse(BaseModel):
    id: UUID
    username: str
    created_at: datetime

    @classmethod
    def from_entity(cls, user: User) -> UserResponse:
        return cls(id=user.id, username=user.username, created_at=user.created_at)


class AuthResponse(BaseModel):
    """Token + dados do usuario, devolvidos no register e no login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse

    @classmethod
    def from_auth(cls, *, access_token: str, user: User) -> AuthResponse:
        return cls(access_token=access_token, user=UserResponse.from_entity(user))

"""Wiring for users slice: binds ports to concrete adapters + session guard."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.users.application.use_cases import (
    AuthenticateUser,
    GetCurrentUser,
    RegisterUser,
)
from modules.users.domain.entities import User
from modules.users.domain.errors import InvalidToken
from modules.users.domain.ports import (
    PasswordHasher,
    TokenService,
    UserRepository,
)
from modules.users.infrastructure.repository import SqlAlchemyUserRepository
from modules.users.infrastructure.security import (
    BcryptPasswordHasher,
    JwtTokenService,
)
from shared.api.dependencies import SessionDep, SettingsDep


def get_user_repository(session: SessionDep) -> UserRepository:
    """Single point that chooses the persistence port implementation."""
    return SqlAlchemyUserRepository(session)


RepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]


def get_password_hasher() -> PasswordHasher:
    return BcryptPasswordHasher()


HasherDep = Annotated[PasswordHasher, Depends(get_password_hasher)]


def get_token_service(settings: SettingsDep) -> TokenService:
    return JwtTokenService(
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expire_minutes=settings.jwt_expire_minutes,
    )


TokenServiceDep = Annotated[TokenService, Depends(get_token_service)]


def get_register_use_case(
    repository: RepositoryDep,
    hasher: HasherDep,
    tokens: TokenServiceDep,
) -> RegisterUser:
    return RegisterUser(repository, hasher, tokens)


RegisterUseCaseDep = Annotated[RegisterUser, Depends(get_register_use_case)]


def get_authenticate_use_case(
    repository: RepositoryDep,
    hasher: HasherDep,
    tokens: TokenServiceDep,
) -> AuthenticateUser:
    return AuthenticateUser(repository, hasher, tokens)


AuthenticateUseCaseDep = Annotated[AuthenticateUser, Depends(get_authenticate_use_case)]


# auto_error=False: we return our own 401 (standard error envelope) instead of
# raw 403 from HTTPBearer when the header is missing.
_bearer_scheme = HTTPBearer(auto_error=False)
BearerDep = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)]


async def get_current_user(
    credentials: BearerDep,
    repository: RepositoryDep,
    tokens: TokenServiceDep,
) -> User:
    """Resolves logged in user from Bearer token. Raises 401 if invalid."""
    if credentials is None or not credentials.credentials:
        raise InvalidToken("Authentication required.")
    user_id = tokens.subject(credentials.credentials)
    return await GetCurrentUser(repository).execute(user_id)


CurrentUserDep = Annotated[User, Depends(get_current_user)]

"""Use cases for users slice. Depend only on domain ports."""

from __future__ import annotations

from uuid import UUID

from modules.users.application.dto import (
    AuthenticatedUser,
    AuthenticateUserCommand,
    RegisterUserCommand,
)
from modules.users.domain.entities import (
    User,
    validate_password,
)
from modules.users.domain.errors import (
    InvalidCredentials,
    UsernameAlreadyTaken,
)
from modules.users.domain.ports import (
    PasswordHasher,
    TokenService,
    UserRepository,
)


class RegisterUser:
    """Registers a new user and returns access token directly."""

    def __init__(
        self,
        repository: UserRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
    ) -> None:
        self._repository = repository
        self._hasher = hasher
        self._tokens = tokens

    async def execute(self, command: RegisterUserCommand) -> AuthenticatedUser:
        # User.create normalizes/validates name; validate_password raises 422 if short.
        validate_password(command.password)
        password_hash = self._hasher.hash(command.password)
        user = User.create(username=command.username, password_hash=password_hash)

        if await self._repository.find_by_username(user.username) is not None:
            raise UsernameAlreadyTaken(f"The user '{command.username}' already exists.")

        saved = await self._repository.add(user)
        return AuthenticatedUser(user=saved, access_token=self._tokens.issue(saved))


class AuthenticateUser:
    """Verifies user + password and issues access token."""

    def __init__(
        self,
        repository: UserRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
    ) -> None:
        self._repository = repository
        self._hasher = hasher
        self._tokens = tokens

    async def execute(self, command: AuthenticateUserCommand) -> AuthenticatedUser:
        # No size validation here: on login, invalid input becomes "invalid credentials"
        # (401), never 422.
        username = (command.username or "").strip().casefold()
        user = await self._repository.find_by_username(username)

        # Intentionally generic message: does not reveal whether username or password failed.
        if user is None or not self._hasher.verify(command.password, user.password_hash):
            raise InvalidCredentials("Invalid username or password.")

        return AuthenticatedUser(user=user, access_token=self._tokens.issue(user))


class GetCurrentUser:
    """Resolves user from ID (token subject)."""

    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    async def execute(self, user_id: UUID) -> User:
        user = await self._repository.get_by_id(user_id)
        if user is None:
            raise InvalidCredentials("Invalid session. Please login again.")
        return user

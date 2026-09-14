"""Casos de uso da fatia users. Dependem apenas de portas do dominio."""

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
    """Cadastra um usuario novo e ja devolve um token para logar direto."""

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
        # User.create normaliza/valida o nome; validate_password levanta 422 se curta.
        validate_password(command.password)
        password_hash = self._hasher.hash(command.password)
        user = User.create(username=command.username, password_hash=password_hash)

        if await self._repository.find_by_username(user.username) is not None:
            raise UsernameAlreadyTaken(f"O usuario '{command.username}' ja existe.")

        saved = await self._repository.add(user)
        return AuthenticatedUser(user=saved, access_token=self._tokens.issue(saved))


class AuthenticateUser:
    """Confere usuario + senha e emite um token de acesso."""

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
        # Sem validar tamanho aqui: no login, entrada invalida vira "credenciais
        # invalidas" (401), nunca 422.
        username = (command.username or "").strip().casefold()
        user = await self._repository.find_by_username(username)

        # Mensagem generica de proposito: nao revela se foi o usuario ou a senha.
        if user is None or not self._hasher.verify(command.password, user.password_hash):
            raise InvalidCredentials("Usuario ou senha invalidos.")

        return AuthenticatedUser(user=user, access_token=self._tokens.issue(user))


class GetCurrentUser:
    """Resolve o usuario a partir do id (subject do token)."""

    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    async def execute(self, user_id: UUID) -> User:
        user = await self._repository.get_by_id(user_id)
        if user is None:
            raise InvalidCredentials("Sessao invalida. Entre novamente.")
        return user

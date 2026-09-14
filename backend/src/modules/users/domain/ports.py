"""Portas (interfaces) do dominio users.

O dominio declara o que precisa; a infraestrutura fornece os adaptadores.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from modules.users.domain.entities import User


class UserRepository(ABC):
    """Porta de persistencia de usuarios."""

    @abstractmethod
    async def add(self, user: User) -> User:
        """Persiste um novo usuario."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None:
        """Busca por identificador."""

    @abstractmethod
    async def find_by_username(self, username: str) -> User | None:
        """Busca pelo nome de usuario (case-insensitive)."""


class PasswordHasher(ABC):
    """Porta de hashing de senha. Mantem o dominio livre de bcrypt/passlib."""

    @abstractmethod
    def hash(self, plain_password: str) -> str:
        """Gera o hash da senha em texto puro."""

    @abstractmethod
    def verify(self, plain_password: str, password_hash: str) -> bool:
        """Confere a senha em texto puro contra o hash guardado."""


class TokenService(ABC):
    """Porta de emissao/validacao de tokens de acesso."""

    @abstractmethod
    def issue(self, user: User) -> str:
        """Emite um token assinado que identifica o usuario."""

    @abstractmethod
    def subject(self, token: str) -> UUID:
        """Extrai o id do usuario do token. Levanta InvalidToken se invalido."""

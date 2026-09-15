"""Ports (interfaces) for users domain.

The domain declares what it needs; infrastructure provides adapters.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from modules.users.domain.entities import User


class UserRepository(ABC):
    """User persistence port."""

    @abstractmethod
    async def add(self, user: User) -> User:
        """Persists a new user."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None:
        """Finds user by identifier."""

    @abstractmethod
    async def find_by_username(self, username: str) -> User | None:
        """Finds user by username (case-insensitive)."""


class PasswordHasher(ABC):
    """Password hashing port. Keeps domain free of bcrypt/passlib dependencies."""

    @abstractmethod
    def hash(self, plain_password: str) -> str:
        """Generates hash from plain text password."""

    @abstractmethod
    def verify(self, plain_password: str, password_hash: str) -> bool:
        """Verifies plain text password against saved hash."""


class TokenService(ABC):
    """Access token issuing and validation port."""

    @abstractmethod
    def issue(self, user: User) -> str:
        """Issues a signed token identifying the user."""

    @abstractmethod
    def subject(self, token: str) -> UUID:
        """Extracts user ID from token. Raises InvalidToken if invalid."""

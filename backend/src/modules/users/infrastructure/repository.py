"""Adaptador SQLAlchemy da porta UserRepository."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.users.domain.entities import User
from modules.users.domain.ports import UserRepository
from modules.users.infrastructure.mappers import to_domain, to_model
from modules.users.infrastructure.models import UserModel


class SqlAlchemyUserRepository(UserRepository):
    """Persiste usuarios via SQLAlchemy async.

    O commit e responsabilidade da unidade de trabalho (dependencia get_session),
    entao aqui usamos apenas flush.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, user: User) -> User:
        model = to_model(user)
        self._session.add(model)
        await self._session.flush()
        return to_domain(model)

    async def get_by_id(self, user_id: UUID) -> User | None:
        model = await self._session.get(UserModel, user_id)
        return to_domain(model) if model is not None else None

    async def find_by_username(self, username: str) -> User | None:
        stmt = select(UserModel).where(UserModel.username == username.casefold())
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return to_domain(model) if model is not None else None

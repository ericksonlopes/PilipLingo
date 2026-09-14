"""Mapeamento ORM da fatia users. Detalhe de infraestrutura, nunca vaza para o dominio."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    # Nome em casefold: garante unicidade case-insensitive de forma portavel.
    username: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<UserModel {self.username!r}>"

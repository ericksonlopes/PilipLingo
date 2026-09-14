"""Registro central dos mapeamentos ORM.

O Alembic importa este modulo para descobrir o metadata completo. Ao criar uma
nova fatia com tabelas, importe os models dela aqui.
"""

from __future__ import annotations

from modules.chat.infrastructure import models as chat_models
from modules.users.infrastructure import models as users_models
from modules.vocabulary.infrastructure import models as vocabulary_models
from shared.database import Base

__all__ = ["Base", "chat_models", "metadata", "users_models", "vocabulary_models"]

metadata = Base.metadata

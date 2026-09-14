"""Router raiz da API versionada.

Para adicionar uma nova fatia vertical: crie o modulo em `src/modules/<slice>`
e registre o router dela aqui.
"""

from __future__ import annotations

from fastapi import APIRouter

from api import health
from modules.chat.api.routes import router as chat_router
from modules.users.api.routes import router as users_router
from modules.vocabulary.api.routes import router as vocabulary_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(users_router)
api_router.include_router(vocabulary_router)
api_router.include_router(chat_router)

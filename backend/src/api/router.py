"""Root router for the versioned API.

To add a new vertical slice: create the module in `src/modules/<slice>`
and register its router here.
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

"""Fabrica da aplicacao FastAPI (composition root)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.router import api_router
from modules.chat.application.dto import SeedDataCommand
from modules.chat.application.use_cases import SeedChatData
from modules.chat.infrastructure.repository import (
    SqlAlchemyGoalRepository,
    SqlAlchemyTopicRepository,
)
from modules.vocabulary.infrastructure.sentence_validator import SentenceValidatorService
from shared.api.error_handlers import register_error_handlers
from shared.config import Settings, get_settings
from shared.database import dispose_engine, get_session_factory
from version import __version__

# Importado pelo efeito colateral de registrar todos os models no metadata do SQLAlchemy.
import orm_registry  # noqa: F401,E402  isort:skip

# ---------- seed data para chat ----------

_CHAT_TOPICS: list[tuple[str, str, str]] = [
    ("At the Airport", "Practice vocabulary and phrases for airport situations", "A2"),
    ("Ordering Food", "Learn to order food and interact with waitstaff", "A1"),
    ("Shopping", "Practice buying clothes, groceries and asking about prices", "A2"),
    ("Daily Routine", "Describe everyday activities and schedules", "A1"),
    ("Weather", "Discuss weather conditions and forecasts", "A1"),
    ("Family", "Talk about family members and relationships", "A1"),
    ("Work & Career", "Discuss jobs, responsibilities and workplace situations", "B1"),
    ("Health & Body", "Practice describing symptoms and visiting a doctor", "B1"),
    ("Travel & Tourism", "Talk about travel plans, landmarks and experiences", "B1"),
    ("Hobbies & Interests", "Share and ask about free time activities", "A2"),
    ("Technology", "Discuss gadgets, apps and how technology affects daily life", "B2"),
    ("Environment", "Talk about environmental issues and sustainability", "B2"),
]

_CHAT_GOALS: list[tuple[str, str, str]] = [
    (
        "Apresentar-se e dar informacoes pessoais",
        "Perguntar e responder sobre nome, origem, profissao e familia",
        "A1",
    ),
    (
        "Descrever rotina diaria com Simple Present",
        "Usar o Simple Present para falar sobre habitos e horarios",
        "A1",
    ),
    (
        "Fazer perguntas sobre o passado",
        "Usar o Simple Past para perguntar e responder sobre eventos passados",
        "A2",
    ),
    (
        "Falar sobre planos futuros",
        "Usar going to e will para expressar planos e previsoes",
        "A2",
    ),
    (
        "Pedir e dar direcoes",
        "Navegar por uma cidade usando vocabulario de direcao e localizacao",
        "A2",
    ),
    (
        "Fazer e aceitar convites",
        "Convidar alguem para atividades e responder a convites de forma educada",
        "B1",
    ),
    (
        "Discutir vantagens e desvantagens",
        "Usar conectivos (however, on the other hand) para argumentar sobre um tema",
        "B1",
    ),
    (
        "Narrar uma historia no passado",
        "Usar Simple Past e Past Continuous para contar uma historia com detalhes",
        "B1",
    ),
    (
        "Expressar opiniao e concordar/discordar",
        "Usar expressoes como I think, I agree because para debates educados",
        "B2",
    ),
    (
        "Conduzir uma entrevista de emprego",
        "Responder perguntas comuns de entrevista com fluencia e vocabulario profissional",
        "B2",
    ),
    (
        "Discutir questoes hipoteticas",
        "Usar o Second Conditional para falar sobre situacoes imaginarias",
        "B2",
    ),
    (
        "Comunicar-se em situacoes de saude",
        "Descrever sintomas, entender instrucoes medicas e fazer perguntas ao medico",
        "B1",
    ),
]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Carrega o modelo spaCy uma unica vez. Falha ruidosamente se ausente.
    _app.state.sentence_validator = SentenceValidatorService.load()

    # Popula topicos e metas do chat se ainda nao existirem.
    session_factory = get_session_factory()
    async with session_factory() as session:
        seed = SeedChatData(
            topics_repo=SqlAlchemyTopicRepository(session),
            goals_repo=SqlAlchemyGoalRepository(session),
        )
        await seed.execute(
            SeedDataCommand(topics=_CHAT_TOPICS, goals=_CHAT_GOALS)
        )
        await session.commit()

    yield
    await dispose_engine()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        debug=settings.debug,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)

    return app


app = create_app()

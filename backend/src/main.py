"""FastAPI application factory (composition root)."""

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

# Imported for side effect of registering all ORM models in SQLAlchemy metadata.
import orm_registry  # noqa: F401,E402  isort:skip

# ---------- seed data for chat ----------

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

_CHAT_GOALS: list[tuple[str, str, str, list[str]]] = [
    (
        "Apresentar-se e dar informacoes pessoais",
        "Perguntar e responder sobre nome, origem, profissao e familia",
        "A1",
        [
            "Saber o nome da pessoa",
            "Saber onde a pessoa mora",
            "Saber qual a idade da pessoa",
        ],
    ),
    (
        "Descrever rotina diaria com Simple Present",
        "Usar o Simple Present para falar sobre habitos e horarios",
        "A1",
        [
            "Descobrir que horas a pessoa acorda",
            "Descobrir o que ela faz no trabalho ou estudo",
            "Descobrir o que ela faz no tempo livre",
        ],
    ),
    (
        "Fazer perguntas sobre o passado",
        "Usar o Simple Past para perguntar e responder sobre eventos passados",
        "A2",
        [
            "Saber onde a pessoa passou o ultimo fim de semana",
            "Saber com quem ela estava",
            "Saber o que ela fez de mais legal",
        ],
    ),
    (
        "Falar sobre planos futuros",
        "Usar going to e will para expressar planos e previsoes",
        "A2",
        [
            "Saber para onde a pessoa quer viajar",
            "Saber quando essa viagem deve acontecer",
            "Saber o que ela mais quer fazer la",
        ],
    ),
    (
        "Pedir e dar direcoes",
        "Navegar por uma cidade usando vocabulario de direcao e localizacao",
        "A2",
        [
            "Saber a localizacao do destino",
            "Saber qual o melhor caminho ou transporte",
            "Saber quanto tempo leva para chegar",
        ],
    ),
    (
        "Fazer e aceitar convites",
        "Convidar alguem para atividades e responder a convites de forma educada",
        "B1",
        [
            "Descobrir que atividade a pessoa gostaria de fazer",
            "Combinar o dia e horario ideal",
            "Definir onde voces vao se encontrar",
        ],
    ),
    (
        "Discutir vantagens e desvantagens",
        "Usar conectivos (however, on the other hand) para argumentar sobre um tema",
        "B1",
        [
            "Descobrir a opiniao geral da pessoa",
            "Extrair pelo menos uma vantagem mencionada",
            "Extrair pelo menos uma desvantagem mencionada",
        ],
    ),
    (
        "Narrar uma historia no passado",
        "Usar Simple Past e Past Continuous para contar uma historia com detalhes",
        "B1",
        [
            "Descobrir quando a historia aconteceu",
            "Descobrir o momento mais emocionante ou inesperado",
            "Descobrir como terminou a historia",
        ],
    ),
    (
        "Expressar opiniao e concordar/discordar",
        "Usar expressoes como I think, I agree because para debates educados",
        "B2",
        [
            "Descobrir a opiniao da pessoa sobre o assunto",
            "Descobrir o argumento principal dela",
            "Descobrir como ela reage ao seu ponto de vista",
        ],
    ),
    (
        "Conduzir uma entrevista de emprego",
        "Responder perguntas comuns de entrevista com fluencia e vocabulario profissional",
        "B2",
        [
            "Descobrir a profissao ou area de atuacao",
            "Descobrir a maior experiencia anterior",
            "Descobrir o principal objetivo de carreira",
        ],
    ),
    (
        "Discutir questoes hipoteticas",
        "Usar o Second Conditional para falar sobre situacoes imaginarias",
        "B2",
        [
            "Descobrir o que a pessoa faria se ganhasse na loteria",
            "Descobrir para onde ela viajaria se pudesse ir a qualquer lugar",
            "Descobrir que profissao diferente ela escolheria",
        ],
    ),
    (
        "Comunicar-se em situacoes de saude",
        "Descrever sintomas, entender instrucoes medicas e fazer perguntas ao medico",
        "B1",
        [
            "Descobrir o que a pessoa esta sentindo",
            "Descobrir ha quanto tempo os sintomas comecaram",
            "Descobrir que recomendacao ou remedio ela precisa",
        ],
    ),
]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Load spaCy model once. Fails noisily if missing.
    _app.state.sentence_validator = SentenceValidatorService.load()

    # Populate chat topics and goals if they do not exist yet.
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

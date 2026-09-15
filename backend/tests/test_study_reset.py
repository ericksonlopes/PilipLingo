"""Testes unitarios para o reset de sessao de estudo e filtro por tema."""

from __future__ import annotations

import random
from datetime import UTC, datetime
from uuid import UUID

import pytest

from modules.vocabulary.application.dto import (
    ResetStudySessionCommand,
    StudySessionQuery,
)
from modules.vocabulary.application.use_cases import (
    BuildStudySession,
    ResetStudySession,
)
from modules.vocabulary.domain.entities import (
    GeneratedSentence,
    ProficiencyLevel,
    SentenceRequest,
)
from modules.vocabulary.domain.ports import SentenceGenerator, StudyCardRepository
from modules.vocabulary.domain.study import ExerciseMode, ReviewGrade, StudyCard


class FakeSentenceGenerator(SentenceGenerator):
    async def generate(self, request: SentenceRequest) -> list[GeneratedSentence]:
        return [
            GeneratedSentence(
                text=f"Generated phrase {i} for {request.topic}",
                translation=f"Frase gerada {i} para {request.topic}",
                level=request.level,
            )
            for i in range(request.count)
        ]


class InMemoryStudyCardRepository(StudyCardRepository):
    def __init__(self) -> None:
        self.cards: dict[UUID, StudyCard] = {}

    async def add_many(self, cards: list[StudyCard]) -> list[StudyCard]:
        for card in cards:
            self.cards[card.id] = card
        return list(cards)

    async def get_by_id(self, card_id: UUID) -> StudyCard | None:
        return self.cards.get(card_id)

    async def update(self, card: StudyCard) -> StudyCard:
        self.cards[card.id] = card
        return card

    async def delete_unreviewed(self, *, level: ProficiencyLevel) -> int:
        to_delete = [
            cid
            for cid, c in self.cards.items()
            if c.level == level and c.repetitions == 0 and c.reviewed_at is None
        ]
        for cid in to_delete:
            del self.cards[cid]
        return len(to_delete)

    async def list_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        limit: int,
        theme: str | None = None,
    ) -> list[StudyCard]:
        matched = [
            c
            for c in self.cards.values()
            if c.level == level
            and c.due_at <= now
            and c.reviewed_at is not None
            and (theme is None or c.theme == theme)
        ]
        return matched[:limit]

    async def list_by_level(
        self,
        *,
        level: ProficiencyLevel,
        limit: int,
        exclude: set[UUID] | None = None,
        theme: str | None = None,
    ) -> list[StudyCard]:
        excluded = exclude or set()
        matched = [
            c
            for c in self.cards.values()
            if c.level == level
            and c.id not in excluded
            and c.reviewed_at is not None
            and (theme is None or c.theme == theme)
        ]
        return matched[:limit]

    async def count_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        theme: str | None = None,
    ) -> int:
        return len(
            [
                c
                for c in self.cards.values()
                if c.level == level
                and c.due_at <= now
                and c.reviewed_at is not None
                and (theme is None or c.theme == theme)
            ]
        )

    async def existing_sentences(self, *, level: ProficiencyLevel) -> set[str]:
        return {c.sentence.casefold() for c in self.cards.values() if c.level == level}

    async def list_reviewed(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[StudyCard]:
        reviewed = [c for c in self.cards.values() if c.reviewed_at is not None]
        return reviewed[offset : offset + limit]

    async def count_reviewed(self) -> int:
        return len([c for c in self.cards.values() if c.reviewed_at is not None])

    async def list_seen_words(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[str, str]]:
        return []

    async def count_seen_words(self) -> int:
        return 0


@pytest.mark.asyncio
async def test_reset_study_session_deletes_only_unreviewed_cards() -> None:
    repo = InMemoryStudyCardRepository()
    use_case = ResetStudySession(repo)

    unreviewed = StudyCard.create(
        sentence="I read books.",
        translation="Eu leio livros.",
        level=ProficiencyLevel.A1,
        theme="reading",
    )
    await repo.add_many([unreviewed])

    reviewed = StudyCard.create(
        sentence="She drinks water.",
        translation="Ela bebe água.",
        level=ProficiencyLevel.A1,
        theme="drinks",
    )
    reviewed.register_review(ReviewGrade.GOOD)
    await repo.add_many([reviewed])

    again_card = StudyCard.create(
        sentence="They walk slowly.",
        translation="Eles andam devagar.",
        level=ProficiencyLevel.A1,
        theme="walking",
    )
    again_card.register_review(ReviewGrade.AGAIN)
    await repo.add_many([again_card])

    assert len(repo.cards) == 3

    deleted = await use_case.execute(ResetStudySessionCommand(level=ProficiencyLevel.A1))

    assert deleted == 1
    assert unreviewed.id not in repo.cards
    assert reviewed.id in repo.cards
    assert again_card.id in repo.cards


@pytest.mark.asyncio
async def test_build_study_session_with_reset_cleans_unreviewed() -> None:
    repo = InMemoryStudyCardRepository()
    generator = FakeSentenceGenerator()
    builder = BuildStudySession(repo, generator, max_per_generation=8, rng=random.Random(42))

    session1 = await builder.execute(
        StudySessionQuery(
            level=ProficiencyLevel.A1,
            limit=4,
            theme="morning routine",
            modes=(ExerciseMode.TYPING_CLOZE,),
        )
    )
    assert len(session1.exercises) == 4
    assert len(repo.cards) == 4

    session2 = await builder.execute(
        StudySessionQuery(
            level=ProficiencyLevel.A1,
            limit=4,
            theme="airport and check-in",
            modes=(ExerciseMode.TYPING_CLOZE,),
            reset=True,
        )
    )
    assert len(session2.exercises) == 4
    # Cards da sessão anterior foram descartados, agora só temos os novos
    assert len(repo.cards) == 4
    for ex in session2.exercises:
        assert ex.card.theme == "airport and check-in"


@pytest.mark.asyncio
async def test_build_study_session_filters_due_cards_by_theme() -> None:
    repo = InMemoryStudyCardRepository()
    generator = FakeSentenceGenerator()
    builder = BuildStudySession(repo, generator, max_per_generation=8, rng=random.Random(42))

    # Card 1: tema "food", já revisado e vencido
    due_food = StudyCard.create(
        sentence="I like pizza.",
        translation="Eu gosto de pizza.",
        level=ProficiencyLevel.A1,
        theme="ordering food at a restaurant",
    )
    due_food.register_review(ReviewGrade.GOOD)
    due_food.due_at = datetime.now(UTC)
    await repo.add_many([due_food])

    # Card 2: tema "trip", já revisado e vencido
    due_trip = StudyCard.create(
        sentence="I pack my bag.",
        translation="Eu arrumo minha mala.",
        level=ProficiencyLevel.A1,
        theme="planning a trip",
    )
    due_trip.register_review(ReviewGrade.GOOD)
    due_trip.due_at = datetime.now(UTC)
    await repo.add_many([due_trip])

    # Pede sessão de "planning a trip": deve vir apenas o due_trip e completar com top_up de trip
    session = await builder.execute(
        StudySessionQuery(
            level=ProficiencyLevel.A1,
            limit=3,
            theme="planning a trip",
            modes=(ExerciseMode.TYPING_CLOZE,),
        )
    )
    assert len(session.exercises) == 3
    # Todas as frases devem ser do tema pedido
    for ex in session.exercises:
        assert ex.card.theme == "planning a trip"
    # due_food não deve ter entrado na sessão de trip
    exercise_card_ids = {ex.card.id for ex in session.exercises}
    assert due_food.id not in exercise_card_ids
    assert due_trip.id in exercise_card_ids

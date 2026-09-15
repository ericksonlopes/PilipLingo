"""Study domain: card with SRS scheduling and session assembly.

By default, a session samples different interaction modes for writing, listening,
word ordering, recognition, and speaking practice.

No framework or ORM dependencies. `random` is stdlib and passed as parameter
(`random.Random`) for reproducibility in tests.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from modules.vocabulary.domain.entities import (
    MAX_EXAMPLE_LENGTH,
    MAX_TERM_LENGTH,
    MAX_TOPIC_LENGTH,
    MAX_TRANSLATION_LENGTH,
    GeneratedSentence,
    SentenceChunk,
    SentenceVocabularyItem,
)
from shared.domain.proficiency import ProficiencyLevel
from shared.errors import ValidationError

__all__ = [
    "DEFAULT_EASE_FACTOR",
    "MATCHING_MAX_CARDS",
    "MATCHING_MIN_CARDS",
    "STUDY_THEME_LABELS",
    "STUDY_THEMES",
    "ExerciseMode",
    "ReviewGrade",
    "StudyCard",
    "StudyExercise",
    "StudySession",
    "assemble_session",
    "random_theme",
]


class ExerciseMode(StrEnum):
    """The six ways to test the same card."""

    TYPING_CLOZE = "TYPING_CLOZE"
    AUDIO_DICTATION = "AUDIO_DICTATION"
    BLOCK_TRANSLATION = "BLOCK_TRANSLATION"
    VOCAB_MATCHING = "VOCAB_MATCHING"
    SPEAKING_PRACTICE = "SPEAKING_PRACTICE"
    SENTENCE_BUILDER = "SENTENCE_BUILDER"

    @property
    def instruction(self) -> str:
        """Prompt instruction shown to the student."""
        return _INSTRUCTIONS[self]

    @property
    def needs_audio(self) -> bool:
        """App needs to play sentence audio before student responds."""
        return self in {ExerciseMode.AUDIO_DICTATION, ExerciseMode.SPEAKING_PRACTICE}

    @property
    def is_group(self) -> bool:
        """Consumes multiple cards at once instead of one."""
        return self is ExerciseMode.VOCAB_MATCHING


_INSTRUCTIONS: dict[ExerciseMode, str] = {
    ExerciseMode.TYPING_CLOZE: "Complete a lacuna com a palavra que falta.",
    ExerciseMode.AUDIO_DICTATION: "Ouça e monte a frase tocando nos blocos.",
    ExerciseMode.BLOCK_TRANSLATION: "Traduza para o inglês ordenando os blocos.",
    ExerciseMode.VOCAB_MATCHING: "Ligue cada frase em inglês à sua tradução.",
    ExerciseMode.SPEAKING_PRACTICE: "Ouça e repita a frase em voz alta.",
    ExerciseMode.SENTENCE_BUILDER: "Escreva uma frase em inglês usando a palavra indicada.",
}

# Single card modes. VOCAB_MATCHING is excluded because it requires a group.
_SINGLE_CARD_MODES: tuple[ExerciseMode, ...] = (
    ExerciseMode.TYPING_CLOZE,
    ExerciseMode.AUDIO_DICTATION,
    ExerciseMode.BLOCK_TRANSLATION,
    ExerciseMode.SPEAKING_PRACTICE,
    ExerciseMode.SENTENCE_BUILDER,
)

MATCHING_MIN_CARDS = 4
MATCHING_MAX_CARDS = 5

# Scheduling parameters (simplified SM-2).
DEFAULT_EASE_FACTOR = 2.5
MIN_EASE_FACTOR = 1.3
MAX_EASE_FACTOR = 2.8
_FIRST_INTERVAL_DAYS = 1
_SECOND_INTERVAL_DAYS = 3
_MAX_INTERVAL_DAYS = 365

# English key goes to generator; Portuguese label goes to UI.
STUDY_THEME_LABELS: dict[str, str] = {
    "morning routine": "Rotina da manhã",
    "job interview": "Entrevista de emprego",
    "renting an apartment": "Alugando um apartamento",
    "going to the doctor": "Consulta médica",
    "airport and check-in": "Aeroporto e check-in",
    "ordering food at a restaurant": "Pedindo comida em um restaurante",
    "small talk with coworkers": "Conversa casual com colegas de trabalho",
    "asking for directions": "Pedindo informações de caminho",
    "online shopping and returns": "Compras online e devoluções",
    "talking about the weekend": "Falando sobre o fim de semana",
    "gym and healthy habits": "Academia e hábitos saudáveis",
    "problems with the internet": "Problemas com a internet",
    "planning a trip": "Planejando uma viagem",
    "watching series and movies": "Séries e filmes",
    "money and paying bills": "Dinheiro e pagamento de contas",
    "studying and taking notes": "Estudos e anotações",
    "public transportation": "Transporte público",
    "making plans with friends": "Planos com amigos",
    "describing a childhood memory": "Uma lembrança da infância",
    "giving an opinion in a meeting": "Opinando em uma reunião",
    "apologizing and fixing a mistake": "Pedindo desculpas e corrigindo um erro",
    "hobbies and free time": "Hobbies e tempo livre",
    "moving to another city": "Mudança para outra cidade",
    "pets and taking care of them": "Animais de estimação e seus cuidados",
    "cooking a simple recipe": "Preparando uma receita simples",
    "phone call with customer support": "Ligação para o suporte ao cliente",
    "talking about future plans": "Falando sobre planos futuros",
    "dealing with a delayed delivery": "Lidando com uma entrega atrasada",
    "describing your neighborhood": "Descrevendo seu bairro",
    "starting a new job": "Começando em um emprego novo",
}
STUDY_THEMES: tuple[str, ...] = tuple(STUDY_THEME_LABELS)


class ReviewGrade(StrEnum):
    """Student performance rating for SRS card review."""

    AGAIN = "AGAIN"
    HARD = "HARD"
    GOOD = "GOOD"
    EASY = "EASY"

    @property
    def is_failure(self) -> bool:
        return self is ReviewGrade.AGAIN


def random_theme(rng: random.Random | None = None) -> str:
    """Selects a random theme from catalog."""
    return (rng or random).choice(STUDY_THEMES)


def _clamp_ease(value: float) -> float:
    return min(MAX_EASE_FACTOR, max(MIN_EASE_FACTOR, round(value, 2)))


def _clean(value: str, *, field_name: str, max_length: int) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"'{field_name}' cannot be empty.")
    if len(text) > max_length:
        raise ValidationError(f"'{field_name}' exceeds {max_length} characters.")
    return text


_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*")
_MIN_CLOZE_WORD_LENGTH = 4
CLOZE_PLACEHOLDER = "____"


@dataclass(slots=True)
class StudyCard:
    """A sentence under study, with structural analysis and SRS state."""

    id: UUID
    sentence: str
    translation: str
    focus_term: str
    level: ProficiencyLevel
    theme: str
    chunks: list[SentenceChunk]
    vocabulary: list[SentenceVocabularyItem]
    repetitions: int
    lapses: int
    ease_factor: float
    interval_days: int
    due_at: datetime
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime | None = None
    focus_term_translation: str | None = None

    @classmethod
    def create(
        cls,
        *,
        sentence: str,
        translation: str,
        level: ProficiencyLevel,
        theme: str,
        focus_term: str | None = None,
        focus_term_translation: str | None = None,
        chunks: list[SentenceChunk] | None = None,
        vocabulary: list[SentenceVocabularyItem] | None = None,
        now: datetime | None = None,
    ) -> StudyCard:
        """Factory validating sentence and setting card due immediately."""
        moment = now or datetime.now(UTC)
        clean_sentence = _clean(sentence, field_name="sentence", max_length=MAX_EXAMPLE_LENGTH)
        clean_ftt = (
            focus_term_translation.strip()[:MAX_TRANSLATION_LENGTH]
            if focus_term_translation and focus_term_translation.strip()
            else None
        )
        return cls(
            id=uuid4(),
            sentence=clean_sentence,
            translation=_clean(
                translation, field_name="translation", max_length=MAX_TRANSLATION_LENGTH
            ),
            focus_term=cls._resolve_focus_term(focus_term, clean_sentence),
            focus_term_translation=clean_ftt,
            level=level,
            theme=_clean(theme, field_name="theme", max_length=MAX_TOPIC_LENGTH),
            chunks=list(chunks or []),
            vocabulary=list(vocabulary or []),
            repetitions=0,
            lapses=0,
            ease_factor=DEFAULT_EASE_FACTOR,
            interval_days=0,
            due_at=moment,
            created_at=moment,
            updated_at=moment,
        )

    @classmethod
    def from_generated(
        cls,
        sentence: GeneratedSentence,
        *,
        theme: str,
        now: datetime | None = None,
    ) -> StudyCard:
        """Converts AI generation result into a persistable card."""
        return cls.create(
            sentence=sentence.text,
            translation=sentence.translation,
            level=sentence.level,
            theme=theme,
            focus_term=sentence.focus_term,
            focus_term_translation=sentence.focus_term_translation,
            chunks=list(sentence.chunks),
            vocabulary=list(sentence.vocabulary),
            now=now,
        )

    def register_review(self, grade: ReviewGrade, *, now: datetime | None = None) -> None:
        """Applies review grade and reschedules card (simplified SM-2)."""
        moment = now or datetime.now(UTC)

        if grade is ReviewGrade.AGAIN:
            self.repetitions = 0
            self.lapses += 1
            self.ease_factor = _clamp_ease(self.ease_factor - 0.20)
            self.interval_days = 0
        elif grade is ReviewGrade.HARD:
            self.repetitions += 1
            self.ease_factor = _clamp_ease(self.ease_factor - 0.15)
            self.interval_days = max(_FIRST_INTERVAL_DAYS, round(self.interval_days * 1.2))
        else:
            self.repetitions += 1
            self.interval_days = self._next_interval()
            if grade is ReviewGrade.EASY:
                self.ease_factor = _clamp_ease(self.ease_factor + 0.15)
                self.interval_days = max(self.interval_days + 1, round(self.interval_days * 1.3))

        self.interval_days = min(_MAX_INTERVAL_DAYS, self.interval_days)
        self.due_at = moment + timedelta(days=self.interval_days)
        self.reviewed_at = moment
        self.updated_at = moment

    def _next_interval(self) -> int:
        if self.repetitions <= 1:
            return _FIRST_INTERVAL_DAYS
        if self.repetitions == 2:
            return _SECOND_INTERVAL_DAYS
        return max(_SECOND_INTERVAL_DAYS, round(self.interval_days * self.ease_factor))

    def is_due(self, *, now: datetime | None = None) -> bool:
        return self.due_at <= (now or datetime.now(UTC))

    @property
    def is_new(self) -> bool:
        return self.repetitions == 0 and self.reviewed_at is None

    @property
    def words(self) -> list[str]:
        """Sentence split into words, preserving attached punctuation."""
        return self.sentence.split()

    @property
    def block_texts(self) -> list[str]:
        """Blocks to assemble sentence: uses structural analysis when present."""
        if len(self.chunks) >= 2:
            return [chunk.text for chunk in self.chunks]
        return self.words

    def cloze(self) -> tuple[str, str]:
        """Returns (sentence with placeholder, expected answer)."""
        answer = self.focus_term
        match = self._find_term(answer)
        if match is None:
            answer = self._fallback_cloze_word()
            match = self._find_term(answer)
        if match is None:
            return self.sentence, answer

        start, end = match
        return f"{self.sentence[:start]}{CLOZE_PLACEHOLDER}{self.sentence[end:]}", answer

    def _find_term(self, term: str) -> tuple[int, int] | None:
        if not term:
            return None
        pattern = re.compile(rf"(?<!\w){re.escape(term)}(?!\w)", re.IGNORECASE)
        found = pattern.search(self.sentence)
        return (found.start(), found.end()) if found else None

    def _fallback_cloze_word(self) -> str:
        candidates: list[str] = _WORD_RE.findall(self.sentence)
        if not candidates:
            return self.focus_term
        long_enough = [word for word in candidates if len(word) >= _MIN_CLOZE_WORD_LENGTH]
        return max(long_enough or candidates, key=len)

    @staticmethod
    def _resolve_focus_term(focus_term: str | None, sentence: str) -> str:
        cleaned = (focus_term or "").strip()
        if cleaned:
            return cleaned[:MAX_TERM_LENGTH]
        candidates: list[str] = _WORD_RE.findall(sentence)
        if not candidates:
            raise ValidationError("Sentence must contain at least one word.")
        return max(candidates, key=len)


@dataclass(frozen=True, slots=True)
class StudyExercise:
    """A card rendered in one of five modes, ready for UI display."""

    mode: ExerciseMode
    card: StudyCard
    prompt: str
    answer: str
    blocks: list[str] = field(default_factory=list)
    group: list[StudyCard] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class StudySession:
    """Daily study session: sampled exercises in execution order."""

    level: ProficiencyLevel
    exercises: list[StudyExercise]
    generated_count: int = 0
    due_count: int = 0
    themes: list[str] = field(default_factory=list)

    @property
    def size(self) -> int:
        return len(self.exercises)

    @property
    def ahead_count(self) -> int:
        return max(0, self.size - self.due_count)


def build_exercise(
    card: StudyCard,
    mode: ExerciseMode,
    *,
    rng: random.Random,
    group: list[StudyCard] | None = None,
) -> StudyExercise:
    """Translates card into requested interaction mode (pure function, no I/O)."""
    if mode is ExerciseMode.TYPING_CLOZE:
        prompt, answer = card.cloze()
        return StudyExercise(mode=mode, card=card, prompt=prompt, answer=answer)

    if mode is ExerciseMode.AUDIO_DICTATION:
        return StudyExercise(
            mode=mode,
            card=card,
            prompt="",
            answer=card.sentence,
            blocks=_shuffled(card.words, rng),
        )

    if mode is ExerciseMode.BLOCK_TRANSLATION:
        return StudyExercise(
            mode=mode,
            card=card,
            prompt=card.translation,
            answer=card.sentence,
            blocks=_shuffled(card.block_texts, rng),
        )

    if mode is ExerciseMode.SPEAKING_PRACTICE:
        return StudyExercise(mode=mode, card=card, prompt="", answer=card.sentence)

    if mode is ExerciseMode.SENTENCE_BUILDER:
        return StudyExercise(mode=mode, card=card, prompt=card.focus_term, answer="", blocks=[])

    members = list(group or [card])
    return StudyExercise(
        mode=ExerciseMode.VOCAB_MATCHING,
        card=card,
        prompt="",
        answer=card.sentence,
        group=members,
    )


def assemble_session(
    cards: list[StudyCard],
    *,
    level: ProficiencyLevel,
    modes: tuple[ExerciseMode, ...] | None = None,
    rng: random.Random | None = None,
    generated_count: int = 0,
    due_count: int = 0,
) -> StudySession:
    """Assembles legacy session or alternates among selected modes."""
    if modes == ():
        raise ValidationError("Select at least one study mode.")
    if modes is not None and any(mode.is_group for mode in modes):
        raise ValidationError("VOCAB_MATCHING cannot be selected alone.")

    generator = rng or random.Random()
    deck = list(cards)
    generator.shuffle(deck)

    if modes is None:
        exercises = [
            build_exercise(card, generator.choice(_SINGLE_CARD_MODES), rng=generator)
            for card in deck
        ]

        if len(deck) >= MATCHING_MIN_CARDS:
            group_size = min(MATCHING_MAX_CARDS, len(deck))
            group = deck[:group_size]
            matching = build_exercise(
                group[0], ExerciseMode.VOCAB_MATCHING, rng=generator, group=group
            )
            exercises.insert(generator.randrange(1, len(exercises) + 1), matching)
    else:
        selected_modes = tuple(dict.fromkeys(modes))
        exercises = [
            build_exercise(card, generator.choice(selected_modes), rng=generator) for card in deck
        ]

    themes: dict[str, None] = {}
    for card in deck:
        themes.setdefault(card.theme, None)

    return StudySession(
        level=level,
        exercises=exercises,
        generated_count=generated_count,
        due_count=due_count,
        themes=list(themes),
    )


def _shuffled(values: list[str], rng: random.Random) -> list[str]:
    shuffled = list(values)
    rng.shuffle(shuffled)
    if len(shuffled) > 1 and shuffled == values:
        shuffled.reverse()
    return shuffled

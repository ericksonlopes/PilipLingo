"""Dominio de estudo: card com agendamento SRS e montagem da sessao.

Por padrao, uma sessao sorteia formas de interacao diferentes para cobrar o mesmo
conteudo por escrita, escuta, ordem das palavras, reconhecimento e fala. Quando o
aluno seleciona formatos, cada card usa apenas um dos modos escolhidos.

Sem dependencia de framework ou ORM: `random` e stdlib e entra por parametro
(`random.Random`) para a montagem ser reproduzivel em teste.
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
    """As seis formas de cobrar o mesmo card."""

    TYPING_CLOZE = "TYPING_CLOZE"
    AUDIO_DICTATION = "AUDIO_DICTATION"
    BLOCK_TRANSLATION = "BLOCK_TRANSLATION"
    VOCAB_MATCHING = "VOCAB_MATCHING"
    SPEAKING_PRACTICE = "SPEAKING_PRACTICE"
    SENTENCE_BUILDER = "SENTENCE_BUILDER"

    @property
    def instruction(self) -> str:
        """Enunciado mostrado ao aluno."""
        return _INSTRUCTIONS[self]

    @property
    def needs_audio(self) -> bool:
        """O app precisa falar a frase antes de o aluno responder."""
        return self in {ExerciseMode.AUDIO_DICTATION, ExerciseMode.SPEAKING_PRACTICE}

    @property
    def is_group(self) -> bool:
        """Consome varios cards de uma vez, em vez de um."""
        return self is ExerciseMode.VOCAB_MATCHING


_INSTRUCTIONS: dict[ExerciseMode, str] = {
    ExerciseMode.TYPING_CLOZE: "Complete a lacuna com a palavra que falta.",
    ExerciseMode.AUDIO_DICTATION: "Ouca e monte a frase tocando nos blocos.",
    ExerciseMode.BLOCK_TRANSLATION: "Traduza para o ingles ordenando os blocos.",
    ExerciseMode.VOCAB_MATCHING: "Ligue cada frase em ingles a sua traducao.",
    ExerciseMode.SPEAKING_PRACTICE: "Ouca e repita a frase em voz alta.",
    ExerciseMode.SENTENCE_BUILDER: "Escreva uma frase em ingles usando a palavra indicada.",
}

# Modos que consomem um card so. VOCAB_MATCHING fica fora porque precisa de grupo.
_SINGLE_CARD_MODES: tuple[ExerciseMode, ...] = (
    ExerciseMode.TYPING_CLOZE,
    ExerciseMode.AUDIO_DICTATION,
    ExerciseMode.BLOCK_TRANSLATION,
    ExerciseMode.SPEAKING_PRACTICE,
    ExerciseMode.SENTENCE_BUILDER,
)

MATCHING_MIN_CARDS = 4
MATCHING_MAX_CARDS = 5

# Parametros do agendamento (SM-2 simplificado).
DEFAULT_EASE_FACTOR = 2.5
MIN_EASE_FACTOR = 1.3
MAX_EASE_FACTOR = 2.8
_FIRST_INTERVAL_DAYS = 1
_SECOND_INTERVAL_DAYS = 3
_MAX_INTERVAL_DAYS = 365

# O valor em ingles vai ao gerador; o rotulo em portugues vai ao menu do app.
# STUDY_THEMES continua sendo o catalogo publico usado pelo sorteio.
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
    """Como o aluno se saiu no exercicio, no vocabulario de app de flashcard."""

    AGAIN = "AGAIN"
    HARD = "HARD"
    GOOD = "GOOD"
    EASY = "EASY"

    @property
    def is_failure(self) -> bool:
        return self is ReviewGrade.AGAIN


def random_theme(rng: random.Random | None = None) -> str:
    """Sorteia um tema do catalogo."""
    return (rng or random).choice(STUDY_THEMES)


def _clamp_ease(value: float) -> float:
    return min(MAX_EASE_FACTOR, max(MIN_EASE_FACTOR, round(value, 2)))


def _clean(value: str, *, field_name: str, max_length: int) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"'{field_name}' nao pode ser vazio.")
    if len(text) > max_length:
        raise ValidationError(f"'{field_name}' excede {max_length} caracteres.")
    return text


# Palavra "cheia": serve de resposta de lacuna. Evita artigos e preposicoes curtas.
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’-]*")
_MIN_CLOZE_WORD_LENGTH = 4
CLOZE_PLACEHOLDER = "____"


@dataclass(slots=True)
class StudyCard:
    """Uma frase em estudo, com a analise estrutural e o estado do agendamento.

    O card e a unidade de revisao: a mesma frase volta em modos diferentes ao
    longo do tempo, e o resultado da revisao move `due_at` para frente.
    """

    id: UUID
    sentence: str
    translation: str
    focus_term: str
    level: ProficiencyLevel
    theme: str
    chunks: list[SentenceChunk]
    repetitions: int
    lapses: int
    ease_factor: float
    interval_days: int
    due_at: datetime
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime | None = None
    # Traducao do termo-alvo em portugues (ex.: "wake up" -> "acordar").
    # None em cards antigos gerados antes desta feature.
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
        now: datetime | None = None,
    ) -> StudyCard:
        """Fabrica que valida a frase e deixa o card vencido para hoje."""
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
            repetitions=0,
            lapses=0,
            ease_factor=DEFAULT_EASE_FACTOR,
            interval_days=0,
            # Card novo entra vencido: e para estudar agora, nao amanha.
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
        """Converte o resultado da IA em card persistivel."""
        return cls.create(
            sentence=sentence.text,
            translation=sentence.translation,
            level=sentence.level,
            theme=theme,
            focus_term=sentence.focus_term,
            focus_term_translation=sentence.focus_term_translation,
            chunks=list(sentence.chunks),
            now=now,
        )

    def register_review(self, grade: ReviewGrade, *, now: datetime | None = None) -> None:
        """Aplica a nota da revisao e reagenda o card (SM-2 simplificado).

        `AGAIN` zera o progresso e devolve o card para a sessao atual
        (`interval_days = 0`), em vez de empurrar para o dia seguinte.
        """
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
        """Frase quebrada em palavras, preservando a pontuacao colada."""
        return self.sentence.split()

    @property
    def block_texts(self) -> list[str]:
        """Blocos para montar a frase: usa a analise estrutural quando existe.

        Ordenar chunks ensina a estrutura ("[I've been] [looking forward to]
        [this moment]"); sem chunks, cai para palavras soltas.
        """
        if len(self.chunks) >= 2:
            return [chunk.text for chunk in self.chunks]
        return self.words

    def cloze(self) -> tuple[str, str]:
        """Devolve (frase com a lacuna, resposta esperada)."""
        answer = self.focus_term
        match = self._find_term(answer)
        if match is None:
            answer = self._fallback_cloze_word()
            match = self._find_term(answer)
        if match is None:  # pragma: no cover - frase sem palavra alfabetica
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
        """Sem o termo na frase, esconde a palavra mais "cheia" disponivel."""
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
        # A IA nem sempre devolve focus_term: escolhe a palavra mais longa da frase.
        candidates: list[str] = _WORD_RE.findall(sentence)
        if not candidates:
            raise ValidationError("A frase precisa ter ao menos uma palavra.")
        return max(candidates, key=len)


@dataclass(frozen=True, slots=True)
class StudyExercise:
    """Um card renderizado em um dos cinco modos, pronto para o app desenhar."""

    mode: ExerciseMode
    card: StudyCard
    prompt: str
    answer: str
    blocks: list[str] = field(default_factory=list)
    group: list[StudyCard] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class StudySession:
    """A sessao do dia: exercicios ja sorteados, na ordem de execucao."""

    level: ProficiencyLevel
    exercises: list[StudyExercise]
    # Quantos cards a IA acabou de criar para fechar a sessao.
    generated_count: int = 0
    # Quantos cards estavam realmente vencidos. O resto e estudo adiantado, que so
    # entra quando faltou conteudo: sem esse numero o app nao conseguiria dizer se
    # o aluno esta em divida com a revisao ou apenas praticando a mais.
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
    """Traduz um card para a interacao pedida (funcao pura, sem I/O)."""
    if mode is ExerciseMode.TYPING_CLOZE:
        prompt, answer = card.cloze()
        return StudyExercise(mode=mode, card=card, prompt=prompt, answer=answer)

    if mode is ExerciseMode.AUDIO_DICTATION:
        return StudyExercise(
            mode=mode,
            card=card,
            # O prompt fica vazio de proposito: quem da a pista e o audio.
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
    """Monta a sessao legada ou alterna apenas entre os modos selecionados."""
    if modes == ():
        raise ValidationError("Selecione pelo menos um modo de estudo.")
    if modes is not None and any(mode.is_group for mode in modes):
        raise ValidationError("VOCAB_MATCHING nao pode ser selecionado isoladamente.")

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
            # Nunca na primeira posicao: a sessao comeca por um exercicio de um card.
            exercises.insert(generator.randrange(1, len(exercises) + 1), matching)
    else:
        # dict preserva a ordem recebida e remove repeticoes previsivelmente.
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
    # Uma unica ordem possivel deixaria o exercicio resolvido de graca.
    if len(shuffled) > 1 and shuffled == values:
        shuffled.reverse()
    return shuffled

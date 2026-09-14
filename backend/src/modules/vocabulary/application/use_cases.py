"""Casos de uso de vocabulary. Dependem apenas da porta VocabularyRepository."""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import UTC, datetime
from uuid import UUID

from modules.vocabulary.application.dto import (
    CreateVocabularyEntryCommand,
    GeneratedSentences,
    GenerateSentencesCommand,
    ListVocabularyQuery,
    PagedVocabulary,
    ReviewStudyCardCommand,
    SaveSessionWordsCommand,
    SaveSessionWordsResult,
    SeenWordItem,
    StudyHistoryPage,
    StudyHistoryQuery,
    StudySessionQuery,
    UpdateVocabularyEntryCommand,
)
from modules.vocabulary.domain.entities import (
    ProficiencyLevel,
    SentenceRequest,
    VocabularyEntry,
)
from modules.vocabulary.domain.errors import (
    DuplicatedTerm,
    SentenceGenerationFailed,
    SentenceGeneratorNotConfigured,
    StudyCardNotFound,
    VocabularyEntryNotFound,
)
from modules.vocabulary.domain.ports import (
    SentenceGenerator,
    StudyCardRepository,
    VocabularyRepository,
    WordTranslator,
)
from modules.vocabulary.domain.study import (
    StudyCard,
    StudySession,
    assemble_session,
    random_theme,
)
from shared.errors import UnavailableError, ValidationError

logger = logging.getLogger(__name__)

# Amostra lida do banco antes do sorteio, para variar as frases entre chamadas.
_TERM_SAMPLE_POOL = 50


class CreateVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, command: CreateVocabularyEntryCommand) -> VocabularyEntry:
        entry = VocabularyEntry.create(
            term=command.term,
            translation=command.translation,
            example=command.example,
            level=command.level,
            tags=command.tags,
        )
        if await self._repository.find_by_term(entry.term) is not None:
            raise DuplicatedTerm(entry.term)
        return await self._repository.add(entry)


class ListVocabularyEntries:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, query: ListVocabularyQuery) -> PagedVocabulary:
        items = await self._repository.list_all(
            search=query.search,
            limit=query.limit,
            offset=query.offset,
        )
        total = await self._repository.count(search=query.search)
        return PagedVocabulary(items=items, total=total, limit=query.limit, offset=query.offset)


class GetVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, entry_id: UUID) -> VocabularyEntry:
        entry = await self._repository.get_by_id(entry_id)
        if entry is None:
            raise VocabularyEntryNotFound(entry_id)
        return entry


class UpdateVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(
        self, entry_id: UUID, command: UpdateVocabularyEntryCommand
    ) -> VocabularyEntry:
        entry = await self._repository.get_by_id(entry_id)
        if entry is None:
            raise VocabularyEntryNotFound(entry_id)
        entry.update(
            translation=command.translation,
            example=command.example,
            level=command.level,
            tags=command.tags,
        )
        return await self._repository.update(entry)


class DeleteVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, entry_id: UUID) -> None:
        if not await self._repository.delete(entry_id):
            raise VocabularyEntryNotFound(entry_id)


class GenerateSentences:
    """Gera frases de exemplo, opcionalmente usando o vocabulario salvo do usuario.

    Antes vivia na fatia `sentences` e alcancava o vocabulario por uma porta
    `TermCatalog`. Agora que as duas capacidades estao na mesma fatia, o caso de
    uso le o repositorio direto e a porta intermediaria deixou de existir.
    """

    def __init__(
        self,
        generator: SentenceGenerator,
        repository: VocabularyRepository,
        *,
        max_per_request: int,
    ) -> None:
        self._generator = generator
        self._repository = repository
        self._max_per_request = max_per_request

    async def execute(self, command: GenerateSentencesCommand) -> GeneratedSentences:
        terms = list(command.terms)
        if not terms and command.use_my_vocabulary:
            terms = await self._sample_terms(level=command.level, limit=command.count)

        request = SentenceRequest.create(
            level=command.level,
            count=command.count,
            max_count=self._max_per_request,
            terms=terms,
            topic=command.topic,
        )
        sentences = await self._generator.generate(request)

        return GeneratedSentences(
            level=request.level,
            items=sentences,
            terms_used=request.terms,
        )

    async def _sample_terms(self, *, level: ProficiencyLevel, limit: int) -> list[str]:
        entries = await self._repository.list_all(limit=_TERM_SAMPLE_POOL, offset=0)
        if not entries:
            return []

        # Prioriza termos do nivel do usuario; se nao houver, usa o vocabulario todo.
        same_level = [entry.term for entry in entries if entry.level == level]
        candidates = same_level or [entry.term for entry in entries]
        return random.sample(candidates, k=min(limit, len(candidates)))


class BuildStudySession:
    """Monta a sessao do dia com revisoes, geracao e modo escolhido.

    O gerador entra como opcional de proposito. Quando a chave da IA nao esta
    configurada (ou o provedor falha), a sessao ainda acontece com o que ja existe
    no banco: so quando nao ha absolutamente nada para estudar o erro sobe e vira
    503. Isso evita que uma dependencia externa derrube a tela principal do app.
    """

    def __init__(
        self,
        cards: StudyCardRepository,
        generator: SentenceGenerator | None,
        *,
        max_per_generation: int,
        rng: random.Random | None = None,
    ) -> None:
        self._cards = cards
        self._generator = generator
        self._max_per_generation = max_per_generation
        self._rng = rng or random.Random()

    async def execute(self, query: StudySessionQuery) -> StudySession:
        if query.modes == ():
            raise ValidationError("Selecione pelo menos um modo de estudo.")
        if query.modes is not None and any(mode.is_group for mode in query.modes):
            raise ValidationError("VOCAB_MATCHING nao pode ser selecionado isoladamente.")

        logger.info(
            "[session] iniciando | level=%s theme=%r limit=%d modes=%s ai=%s",
            query.level.value,
            query.theme,
            query.limit,
            [m.value for m in (query.modes or [])],
            "on" if self._generator is not None else "off",
        )

        now = datetime.now(UTC)
        deck = await self._cards.list_due(level=query.level, now=now, limit=query.limit)
        # Cards vencidos + os recem-gerados (que nascem vencidos) contam como divida
        # de revisao. O que vier depois disso e estudo adiantado.
        due_count = len(deck)
        logger.info("[session] cards vencidos no banco: %d/%d", due_count, query.limit)

        generated = 0
        if len(deck) < query.limit:
            missing = query.limit - len(deck)
            logger.info("[session] faltam %d cards, chamando _top_up", missing)
            new_cards = await self._top_up(query, missing=missing)
            deck.extend(new_cards)
            generated = len(new_cards)
            due_count += generated
            logger.info("[session] _top_up gerou %d cards novos", generated)

        if len(deck) < query.limit:
            # Ainda faltando: adianta revisao de cards do nivel que nao venceram.
            # Melhor estudar adiantado do que abrir o app numa tela vazia.
            advanced = await self._cards.list_by_level(
                level=query.level,
                limit=query.limit - len(deck),
                exclude={card.id for card in deck},
            )
            logger.info(
                "[session] adiantando %d cards futuros para completar o deck",
                len(advanced),
            )
            deck.extend(advanced)

        logger.info(
            "[session] deck final: %d cards (gerados=%d vencidos=%d)",
            len(deck), generated, due_count,
        )

        if not deck:
            self._fail_empty()

        return assemble_session(
            deck,
            level=query.level,
            modes=query.modes,
            rng=self._rng,
            generated_count=generated,
            due_count=due_count,
        )

    async def _top_up(self, query: StudySessionQuery, *, missing: int) -> list[StudyCard]:
        """Gera cards novos para fechar a sessao. Falha de IA aqui nao e fatal."""
        if self._generator is None:
            logger.warning("[top_up] gerador de IA nao configurado (generator=None), retornando []")
            return []

        # Normaliza uma unica vez: o mesmo tema precisa ir ao gerador e ao card.
        # Assim, uma query so com espacos cai no tema surpresa antes de consumir IA.
        requested_theme = query.theme.strip() if query.theme is not None else ""
        theme = requested_theme or random_theme(self._rng)
        count = min(missing, self._max_per_generation)
        request = SentenceRequest.create(
            level=query.level,
            count=count,
            max_count=self._max_per_generation,
            topic=theme,
        )
        logger.info(
            "[top_up] solicitando %d frases ao Gemini | level=%s tema=%r",
            count, query.level.value, theme,
        )

        try:
            sentences = await self._generator.generate(request)
            logger.info("[top_up] Gemini retornou %d frases", len(sentences))
        except UnavailableError as cause:
            # Ja tem card vencido? Segue a sessao. Nada? _fail_empty levanta depois.
            logger.warning("[top_up] geracao falhou, seguindo sem novos cards: %s", cause.message)
            return []

        known = await self._cards.existing_sentences(level=query.level)
        fresh: list[StudyCard] = []
        duplicates = 0
        for sentence in sentences:
            if sentence.text.casefold() in known:
                duplicates += 1
                continue
            known.add(sentence.text.casefold())
            fresh.append(StudyCard.from_generated(sentence, theme=theme))

        if duplicates:
            logger.info("[top_up] %d frase(s) descartada(s) por duplicata", duplicates)

        saved = await self._cards.add_many(fresh)
        logger.info("[top_up] %d cards novos salvos no banco", len(saved))
        return saved

    def _fail_empty(self) -> None:
        """Sem card e sem IA nao existe sessao possivel: explica qual e o caso."""
        if self._generator is None:
            logger.error("[session] nenhum card disponivel e IA nao configurada")
            raise SentenceGeneratorNotConfigured
        logger.error("[session] nenhum card disponivel mesmo com IA configurada")
        raise SentenceGenerationFailed("nenhum card disponivel para estudar agora")


class ReviewStudyCard:
    """Aplica a nota da revisao e reagenda o card."""

    def __init__(self, repository: StudyCardRepository) -> None:
        self._repository = repository

    async def execute(self, card_id: UUID, command: ReviewStudyCardCommand) -> StudyCard:
        card = await self._repository.get_by_id(card_id)
        if card is None:
            raise StudyCardNotFound(card_id)
        card.register_review(command.grade)
        return await self._repository.update(card)


class GetStudyHistory:
    """Retorna as frases e palavras ja vistas pelo usuario, paginadas.

    Frases: todos os cards com reviewed_at IS NOT NULL, ordenados do mais
    recente para o mais antigo.
    Palavras: focus_term unicas vistas, com a traducao do ultimo card revisado,
    ordenadas pela revisao mais recente.
    """

    def __init__(self, repository: StudyCardRepository) -> None:
        self._repository = repository

    async def execute(self, query: StudyHistoryQuery) -> StudyHistoryPage:
        logger.info(
            "[history] buscando historico | limit=%d offset=%d",
            query.limit,
            query.offset,
        )
        sentences, sentences_total, word_rows, words_total = await asyncio.gather(
            self._repository.list_reviewed(limit=query.limit, offset=query.offset),
            self._repository.count_reviewed(),
            self._repository.list_seen_words(limit=query.limit, offset=query.offset),
            self._repository.count_seen_words(),
        )
        words = [
            SeenWordItem(term=term, translation=translation)
            for term, translation in word_rows
        ]
        logger.info(
            "[history] encontradas %d frases (total=%d) e %d palavras unicas (total=%d)",
            len(sentences),
            sentences_total,
            len(words),
            words_total,
        )
        return StudyHistoryPage(
            sentences=sentences,
            sentences_total=sentences_total,
            words=words,
            words_total=words_total,
            limit=query.limit,
            offset=query.offset,
        )


class SaveSessionWords:
    """Traduz palavras de uma sessao e persiste no historico individual.

    Fluxo:
    1. Recebe lista de palavras em ingles (focus_terms da sessao).
    2. Deduplica e normaliza.
    3. Traduz via WordTranslator (deep-translator).
    4. Persiste via SeenWordsRepository (upsert: nova palavra ou incrementa contador).
    """

    def __init__(
        self,
        translator: WordTranslator,
        seen_words_repo: SeenWordsRepositoryProtocol,
    ) -> None:
        self._translator = translator
        self._repo = seen_words_repo

    async def execute(self, command: SaveSessionWordsCommand) -> SaveSessionWordsResult:
        # Deduplica preservando a grafia original (casefold so para unicidade).
        unique: dict[str, str] = {}
        for word in command.words:
            cleaned = word.strip()
            if cleaned:
                unique.setdefault(cleaned.casefold(), cleaned)
        words = list(unique.values())

        if not words:
            return SaveSessionWordsResult(saved=0, translated=0)

        # Traducoes ja conhecidas (vindas do vocabulario gerado pela IA no card),
        # indexadas por casefold para casar com a deduplicacao acima.
        provided: dict[str, str] = {}
        for term, translation in command.translations.items():
            cleaned_term = term.strip()
            cleaned_translation = (translation or "").strip()
            if cleaned_term and cleaned_translation:
                provided.setdefault(cleaned_term.casefold(), cleaned_translation)

        translations: dict[str, str] = {}
        missing: list[str] = []
        for word in words:
            hit = provided.get(word.casefold())
            if hit:
                translations[word] = hit
            else:
                missing.append(word)

        # Tradutor externo so para o que faltou. Ele e limitado por rate limit
        # (Google free tier), entao nunca deve ser o unico caminho: sem o fallback
        # da IA, uma sessao inteira ficaria sem palavras no historico.
        if missing:
            logger.info(
                "[session_words] %d ja traduzidas pela IA, %d via deep-translator",
                len(translations), len(missing),
            )
            fallback = await self._translator.translate_many(missing)
            translations.update(fallback)
        else:
            logger.info(
                "[session_words] %d palavras traduzidas pela IA (sem chamada externa)",
                len(translations),
            )

        translated = len(translations)

        # Palavras sem traducao ficam de fora do upsert.
        saved = await self._repo.upsert_many(translations)
        logger.info(
            "[session_words] %d/%d palavras salvas no banco", saved, len(words)
        )
        return SaveSessionWordsResult(saved=saved, translated=translated)


# Protocolo local para desacoplar o use case do adaptador concreto.
# Evita import circular entre application e infrastructure.
from typing import Protocol  # noqa: E402


class SeenWordsRepositoryProtocol(Protocol):
    async def upsert_many(self, words_translations: dict[str, str]) -> int: ...

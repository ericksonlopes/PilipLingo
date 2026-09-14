"""Wiring da fatia vocabulary: liga portas a adaptadores concretos."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from modules.users.api.dependencies import CurrentUserDep
from modules.vocabulary.application.translate_phrase import TranslatePhrase
from modules.vocabulary.application.use_cases import (
    BuildStudySession,
    CreateVocabularyEntry,
    DeleteVocabularyEntry,
    GenerateSentences,
    GetStudyHistory,
    GetVocabularyEntry,
    ListVocabularyEntries,
    ReviewStudyCard,
    SaveSessionWords,
    UpdateVocabularyEntry,
)
from modules.vocabulary.domain.ports import (
    PhraseTranslator,
    SentenceGenerator,
    StudyCardRepository,
    VocabularyRepository,
    WordTranslator,
)
from modules.vocabulary.infrastructure.chat_model import create_chat_model
from modules.vocabulary.infrastructure.gemini_generator import GeminiSentenceGenerator
from modules.vocabulary.infrastructure.gemini_phrase_translator import GeminiPhraseTranslator
from modules.vocabulary.infrastructure.repository import (
    SqlAlchemyVocabularyRepository,
)
from modules.vocabulary.infrastructure.seen_words_repository import (
    SqlAlchemySeenWordsRepository,
)
from modules.vocabulary.infrastructure.sentence_validator import SentenceValidatorService
from modules.vocabulary.infrastructure.study_repository import (
    SqlAlchemyStudyCardRepository,
)
from modules.vocabulary.infrastructure.word_translator import DeepWordTranslator
from shared.api.dependencies import SessionDep, SettingsDep


def get_vocabulary_repository(session: SessionDep, user: CurrentUserDep) -> VocabularyRepository:
    """Unico ponto que escolhe a implementacao da porta, ja no escopo do usuario."""
    return SqlAlchemyVocabularyRepository(session, user_id=user.id)


RepositoryDep = Annotated[VocabularyRepository, Depends(get_vocabulary_repository)]


def get_create_use_case(repository: RepositoryDep) -> CreateVocabularyEntry:
    return CreateVocabularyEntry(repository)


def get_list_use_case(repository: RepositoryDep) -> ListVocabularyEntries:
    return ListVocabularyEntries(repository)


def get_get_use_case(repository: RepositoryDep) -> GetVocabularyEntry:
    return GetVocabularyEntry(repository)


def get_update_use_case(repository: RepositoryDep) -> UpdateVocabularyEntry:
    return UpdateVocabularyEntry(repository)


def get_delete_use_case(repository: RepositoryDep) -> DeleteVocabularyEntry:
    return DeleteVocabularyEntry(repository)


def get_sentence_generator(settings: SettingsDep) -> SentenceGenerator:
    """Levanta SentenceGeneratorNotConfigured (503) se faltar a chave da API."""
    return GeminiSentenceGenerator(create_chat_model(settings))


def get_optional_sentence_generator(settings: SettingsDep) -> SentenceGenerator | None:
    """Versao tolerante: devolve None em vez de 503 quando a IA nao esta ligada.

    A sessao de estudo usa esta, para continuar funcionando com os cards que ja
    estao no banco mesmo sem chave de IA configurada.
    """
    if not settings.is_ai_configured:
        return None
    return GeminiSentenceGenerator(create_chat_model(settings))


def get_study_card_repository(session: SessionDep, user: CurrentUserDep) -> StudyCardRepository:
    return SqlAlchemyStudyCardRepository(session, user_id=user.id)


StudyRepositoryDep = Annotated[StudyCardRepository, Depends(get_study_card_repository)]


def get_generate_sentences_use_case(
    generator: Annotated[SentenceGenerator, Depends(get_sentence_generator)],
    repository: RepositoryDep,
    settings: SettingsDep,
) -> GenerateSentences:
    return GenerateSentences(
        generator,
        repository,
        max_per_request=settings.sentences_max_per_request,
    )


def get_build_study_session_use_case(
    generator: Annotated[SentenceGenerator | None, Depends(get_optional_sentence_generator)],
    cards: StudyRepositoryDep,
    settings: SettingsDep,
) -> BuildStudySession:
    return BuildStudySession(
        cards,
        generator,
        max_per_generation=settings.sentences_max_per_request,
    )


def get_review_study_card_use_case(cards: StudyRepositoryDep) -> ReviewStudyCard:
    return ReviewStudyCard(cards)


def get_study_history_use_case(cards: StudyRepositoryDep) -> GetStudyHistory:
    return GetStudyHistory(cards)


def get_word_translator() -> WordTranslator:
    return DeepWordTranslator()


def get_save_session_words_use_case(
    session: SessionDep,
    user: CurrentUserDep,
    translator: Annotated[WordTranslator, Depends(get_word_translator)],
) -> SaveSessionWords:
    repo = SqlAlchemySeenWordsRepository(session, user_id=user.id)
    return SaveSessionWords(translator, repo)


CreateUseCaseDep = Annotated[CreateVocabularyEntry, Depends(get_create_use_case)]
ListUseCaseDep = Annotated[ListVocabularyEntries, Depends(get_list_use_case)]
GetUseCaseDep = Annotated[GetVocabularyEntry, Depends(get_get_use_case)]
UpdateUseCaseDep = Annotated[UpdateVocabularyEntry, Depends(get_update_use_case)]
DeleteUseCaseDep = Annotated[DeleteVocabularyEntry, Depends(get_delete_use_case)]
GenerateSentencesDep = Annotated[GenerateSentences, Depends(get_generate_sentences_use_case)]
BuildStudySessionDep = Annotated[BuildStudySession, Depends(get_build_study_session_use_case)]
ReviewStudyCardDep = Annotated[ReviewStudyCard, Depends(get_review_study_card_use_case)]
StudyHistoryDep = Annotated[GetStudyHistory, Depends(get_study_history_use_case)]
SaveSessionWordsDep = Annotated[SaveSessionWords, Depends(get_save_session_words_use_case)]


def get_sentence_validator(request: Request) -> SentenceValidatorService:
    """Recupera o singleton carregado no lifespan da aplicacao."""
    return request.app.state.sentence_validator  # type: ignore[no-any-return]


SentenceValidatorDep = Annotated[SentenceValidatorService, Depends(get_sentence_validator)]


def get_phrase_translator(settings: SettingsDep) -> PhraseTranslator:
    """Levanta SentenceGeneratorNotConfigured (503) se faltar a chave da API."""
    return GeminiPhraseTranslator(create_chat_model(settings))


def get_translate_phrase_use_case(
    translator: Annotated[PhraseTranslator, Depends(get_phrase_translator)],
) -> TranslatePhrase:
    return TranslatePhrase(translator)


TranslatePhraseDep = Annotated[TranslatePhrase, Depends(get_translate_phrase_use_case)]

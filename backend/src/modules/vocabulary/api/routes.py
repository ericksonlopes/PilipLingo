"""HTTP routes for vocabulary slice.

Includes vocabulary CRUD and AI example sentence generation.

Order matters: fixed path routes (`/levels`, `/sentences/...`) are declared
before `/{entry_id}` so FastAPI does not attempt to parse "levels" as UUID.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from modules.users.api.dependencies import CurrentUserDep
from modules.vocabulary.api.dependencies import (
    BuildStudySessionDep,
    CraftPhraseDep,
    CreateUseCaseDep,
    DeleteUseCaseDep,
    GenerateSentencesDep,
    GetUseCaseDep,
    ListUseCaseDep,
    ResetStudySessionDep,
    ReviewStudyCardDep,
    SaveSessionWordsDep,
    SentenceValidatorDep,
    StudyHistoryDep,
    TranslatePhraseDep,
    UpdateUseCaseDep,
)
from modules.vocabulary.api.schemas import (
    AiStatusResponse,
    GenerateSentencesRequest,
    GenerateSentencesResponse,
    LevelOption,
    PhraseCraftRequest,
    PhraseCraftResponse,
    ReviewStudyCardRequest,
    ReviewStudyCardResponse,
    SaveSessionWordsRequest,
    SaveSessionWordsResponse,
    SentenceBuilderValidateRequest,
    SentenceBuilderValidateResponse,
    StudyHistoryResponse,
    StudyModeOption,
    StudyOptionsResponse,
    StudySessionResponse,
    StudyThemeOption,
    TranslateRequest,
    TranslateResponse,
    VocabularyEntryCreateRequest,
    VocabularyEntryResponse,
    VocabularyEntryUpdateRequest,
    VocabularyListResponse,
)
from modules.vocabulary.application.dto import (
    DEFAULT_SESSION_SIZE,
    MAX_SESSION_SIZE,
    CreateVocabularyEntryCommand,
    GenerateSentencesCommand,
    ListVocabularyQuery,
    PhraseCraftCommand,
    ResetStudySessionCommand,
    ReviewStudyCardCommand,
    SaveSessionWordsCommand,
    StudyHistoryQuery,
    StudySessionQuery,
    TranslationCommand,
    UpdateVocabularyEntryCommand,
)
from modules.vocabulary.domain.study import STUDY_THEME_LABELS, ExerciseMode
from shared.api.dependencies import SettingsDep
from shared.domain.proficiency import ProficiencyLevel

router = APIRouter(prefix="/vocabulary", tags=["vocabulary"])

_STUDY_MODE_LABELS: dict[ExerciseMode, str] = {
    ExerciseMode.TYPING_CLOZE: "Completar lacuna",
    ExerciseMode.AUDIO_DICTATION: "Ditado",
    ExerciseMode.BLOCK_TRANSLATION: "Ordenar tradução",
    ExerciseMode.SPEAKING_PRACTICE: "Praticar fala",
    ExerciseMode.SENTENCE_BUILDER: "Criar frase",
}


@router.post(
    "",
    response_model=VocabularyEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a vocabulary item",
)
async def create_entry(
    payload: VocabularyEntryCreateRequest,
    use_case: CreateUseCaseDep,
) -> VocabularyEntryResponse:
    entry = await use_case.execute(
        CreateVocabularyEntryCommand(
            term=payload.term,
            translation=payload.translation,
            example=payload.example,
            level=payload.level,
            tags=payload.tags,
        )
    )
    return VocabularyEntryResponse.from_entity(entry)


@router.get("", response_model=VocabularyListResponse, summary="List vocabulary items")
async def list_entries(
    use_case: ListUseCaseDep,
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> VocabularyListResponse:
    page = await use_case.execute(ListVocabularyQuery(search=search, limit=limit, offset=offset))
    return VocabularyListResponse(
        items=[VocabularyEntryResponse.from_entity(entry) for entry in page.items],
        total=page.total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/levels", response_model=list[LevelOption], summary="Available CEFR levels")
async def list_levels() -> list[LevelOption]:
    return [LevelOption(level=level, label=level.label) for level in ProficiencyLevel]


@router.get(
    "/sentences/status",
    response_model=AiStatusResponse,
    summary="Is AI sentence generation active?",
)
async def ai_status(settings: SettingsDep) -> AiStatusResponse:
    enabled = settings.is_ai_configured
    return AiStatusResponse(
        enabled=enabled,
        model=settings.gemini_model if enabled else None,
        max_sentences_per_request=settings.sentences_max_per_request,
    )


@router.post(
    "/sentences/generate",
    response_model=GenerateSentencesResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate example sentences at user CEFR level",
    responses={503: {"description": "AI not configured or unavailable"}},
)
async def generate_sentences(
    payload: GenerateSentencesRequest,
    use_case: GenerateSentencesDep,
) -> GenerateSentencesResponse:
    result = await use_case.execute(
        GenerateSentencesCommand(
            level=payload.level,
            count=payload.count,
            terms=payload.terms,
            topic=payload.topic,
            use_my_vocabulary=payload.use_my_vocabulary,
        )
    )
    return GenerateSentencesResponse.from_result(result)


@router.get(
    "/study/options",
    response_model=StudyOptionsResponse,
    summary="Available modes and themes for session setup",
)
async def study_options() -> StudyOptionsResponse:
    return StudyOptionsResponse(
        modes=[
            StudyModeOption(mode=mode, label=label) for mode, label in _STUDY_MODE_LABELS.items()
        ],
        themes=[StudyThemeOption(theme=None, label="Tema surpresa")]
        + [
            StudyThemeOption(theme=theme, label=label)
            for theme, label in STUDY_THEME_LABELS.items()
        ],
    )


@router.get(
    "/study/today",
    response_model=StudySessionResponse,
    summary="Daily study session with selected modes",
    responses={503: {"description": "No cards to study and AI unavailable"}},
)
async def study_today(
    use_case: BuildStudySessionDep,
    level: Annotated[ProficiencyLevel, Query(description="User CEFR level.")],
    limit: Annotated[int, Query(ge=1, le=MAX_SESSION_SIZE)] = DEFAULT_SESSION_SIZE,
    theme: Annotated[
        str | None,
        Query(max_length=120, description="Topic for new sentences. Empty = random."),
    ] = None,
    modes: Annotated[
        list[ExerciseMode] | None,
        Query(
            description=(
                "Selected individual modes, repeating query param. "
                "Omitted preserves legacy setup."
            )
        ),
    ] = None,
    reset: Annotated[
        bool,
        Query(description="Discard unreviewed cards from previous sessions before building."),
    ] = False,
) -> StudySessionResponse:
    session = await use_case.execute(
        StudySessionQuery(
            level=level,
            limit=limit,
            theme=theme,
            modes=tuple(modes) if modes is not None else None,
            reset=reset,
        )
    )
    return StudySessionResponse.from_entity(session)


@router.post(
    "/study/reset",
    status_code=status.HTTP_200_OK,
    summary="Discard unreviewed cards from abandoned sessions",
)
async def reset_study_session(
    use_case: ResetStudySessionDep,
    level: Annotated[ProficiencyLevel, Query(description="User CEFR level.")],
) -> dict[str, int]:
    deleted = await use_case.execute(ResetStudySessionCommand(level=level))
    return {"deleted": deleted}


@router.post(
    "/study/{card_id}/review",
    response_model=ReviewStudyCardResponse,
    summary="Register review result and reschedule card",
    responses={404: {"description": "Card not found"}},
)
async def review_study_card(
    card_id: UUID,
    payload: ReviewStudyCardRequest,
    use_case: ReviewStudyCardDep,
) -> ReviewStudyCardResponse:
    card = await use_case.execute(card_id, ReviewStudyCardCommand(grade=payload.grade))
    return ReviewStudyCardResponse.from_entity(card)


@router.get(
    "/study/history",
    response_model=StudyHistoryResponse,
    summary="History of sentences and words seen by user",
)
async def study_history(
    use_case: StudyHistoryDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StudyHistoryResponse:
    page = await use_case.execute(StudyHistoryQuery(limit=limit, offset=offset))
    return StudyHistoryResponse.from_dto(page)


@router.post(
    "/study/session-words",
    response_model=SaveSessionWordsResponse,
    status_code=status.HTTP_200_OK,
    summary="Translate and save words seen in a completed session",
)
async def save_session_words(
    payload: SaveSessionWordsRequest,
    use_case: SaveSessionWordsDep,
) -> SaveSessionWordsResponse:
    result = await use_case.execute(
        SaveSessionWordsCommand(words=payload.words, translations=payload.translations)
    )
    return SaveSessionWordsResponse(saved=result.saved, translated=result.translated)


@router.post(
    "/study/sentence-builder/validate",
    response_model=SentenceBuilderValidateResponse,
    summary="Validate sentence created by user in SENTENCE_BUILDER mode",
    responses={503: {"description": "spaCy model unavailable"}},
)
async def validate_sentence_builder(
    payload: SentenceBuilderValidateRequest,
    validator: SentenceValidatorDep,
) -> SentenceBuilderValidateResponse:
    result = validator.validate(payload.sentence, payload.focus_term)
    return SentenceBuilderValidateResponse(
        valid=result.valid,
        reason=result.reason,
        feedback=result.feedback,
    )


@router.post(
    "/translate",
    response_model=TranslateResponse,
    summary="Translate phrase and return structural block analysis",
    responses={
        503: {"description": "AI service not configured or unavailable"},
    },
)
async def translate_phrase(
    payload: TranslateRequest,
    use_case: TranslatePhraseDep,
    _user: CurrentUserDep,
) -> TranslateResponse:
    result = await use_case.execute(TranslationCommand(text=payload.text))
    return TranslateResponse.from_result(result)


@router.post(
    "/phrase-craft",
    response_model=PhraseCraftResponse,
    summary="Craft natural English phrases from user intent with patterns and tips",
    responses={
        503: {"description": "AI service not configured or unavailable"},
    },
)
async def craft_phrase(
    payload: PhraseCraftRequest,
    use_case: CraftPhraseDep,
    _user: CurrentUserDep,
) -> PhraseCraftResponse:
    result = await use_case.execute(PhraseCraftCommand(text=payload.text))
    return PhraseCraftResponse.from_result(result)


@router.get(
    "/{entry_id}",
    response_model=VocabularyEntryResponse,
    summary="Get vocabulary item details",
)
async def get_entry(entry_id: UUID, use_case: GetUseCaseDep) -> VocabularyEntryResponse:
    return VocabularyEntryResponse.from_entity(await use_case.execute(entry_id))


@router.patch(
    "/{entry_id}",
    response_model=VocabularyEntryResponse,
    summary="Update a vocabulary item",
)
async def update_entry(
    entry_id: UUID,
    payload: VocabularyEntryUpdateRequest,
    use_case: UpdateUseCaseDep,
) -> VocabularyEntryResponse:
    entry = await use_case.execute(
        entry_id,
        UpdateVocabularyEntryCommand(
            translation=payload.translation,
            example=payload.example,
            level=payload.level,
            tags=payload.tags,
        ),
    )
    return VocabularyEntryResponse.from_entity(entry)


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a vocabulary item",
)
async def delete_entry(entry_id: UUID, use_case: DeleteUseCaseDep) -> Response:
    await use_case.execute(entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Domain errors specific to vocabulary slice."""

from __future__ import annotations

from uuid import UUID

from shared.errors import ConflictError, NotFoundError, UnavailableError


class VocabularyEntryNotFound(NotFoundError):
    code = "vocabulary_entry_not_found"

    def __init__(self, entry_id: UUID) -> None:
        super().__init__(f"Vocabulary item {entry_id} not found.")
        self.entry_id = entry_id


class DuplicatedTerm(ConflictError):
    code = "vocabulary_term_already_exists"

    def __init__(self, term: str) -> None:
        super().__init__(f"Term '{term}' already exists in vocabulary.")
        self.term = term


class SentenceGeneratorNotConfigured(UnavailableError):
    """AI provider key is not configured."""

    code = "sentence_generator_not_configured"

    def __init__(self) -> None:
        super().__init__(
            "Sentence generation unavailable: configure PILIPLINGO_GOOGLE_API_KEY in backend."
        )


class SentenceGenerationFailed(UnavailableError):
    """AI provider failed or returned unusable content."""

    code = "sentence_generation_failed"

    def __init__(self, detail: str) -> None:
        super().__init__(f"Could not generate sentences now: {detail}")


class StudyCardNotFound(NotFoundError):
    code = "study_card_not_found"

    def __init__(self, card_id: UUID) -> None:
        super().__init__(f"Study card {card_id} not found.")
        self.card_id = card_id

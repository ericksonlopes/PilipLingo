"""Erros especificos do dominio vocabulary."""

from __future__ import annotations

from uuid import UUID

from shared.errors import ConflictError, NotFoundError, UnavailableError


class VocabularyEntryNotFound(NotFoundError):
    code = "vocabulary_entry_not_found"

    def __init__(self, entry_id: UUID) -> None:
        super().__init__(f"Item de vocabulario {entry_id} nao encontrado.")
        self.entry_id = entry_id


class DuplicatedTerm(ConflictError):
    code = "vocabulary_term_already_exists"

    def __init__(self, term: str) -> None:
        super().__init__(f"O termo '{term}' ja existe no vocabulario.")
        self.term = term


class SentenceGeneratorNotConfigured(UnavailableError):
    """Falta configurar a chave do provedor de IA."""

    code = "sentence_generator_not_configured"

    def __init__(self) -> None:
        super().__init__(
            "Geracao de frases indisponivel: configure PILIPLINGO_GOOGLE_API_KEY no backend."
        )


class SentenceGenerationFailed(UnavailableError):
    """O provedor de IA falhou ou devolveu conteudo inutilizavel."""

    code = "sentence_generation_failed"

    def __init__(self, detail: str) -> None:
        super().__init__(f"Nao foi possivel gerar as frases agora: {detail}")


class StudyCardNotFound(NotFoundError):
    code = "study_card_not_found"

    def __init__(self, card_id: UUID) -> None:
        super().__init__(f"Card de estudo {card_id} nao encontrado.")
        self.card_id = card_id

"""Sentence validator using spaCy en_core_web_sm.

Three sequential rules:
1. Whole-word presence of focus_term (spaCy tokenization, case-insensitive).
2. Subject-verb structure: verbal ROOT with nsubj/nsubjpass dependent.
3. Subject-verb agreement: morph Number+Person matching.

Service does not depend on FastAPI, SQLAlchemy, or domain entities.
Receives strings and returns pure dataclasses.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

import spacy
from spacy.language import Language


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Immutable sentence validation result."""

    valid: bool
    reason: Literal["missing_term", "no_subject_verb", "agreement_error"] | None = None
    feedback: str | None = None


class SentenceValidatorService:
    """Validates English sentences with three progressive linguistic rules.

    Receives spaCy model instance in constructor for dependency injection in tests.
    """

    def __init__(self, nlp: Language) -> None:
        self._nlp = nlp

    @classmethod
    def load(cls) -> SentenceValidatorService:
        """Loads en_core_web_sm model and returns a ready instance."""
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError as exc:
            raise RuntimeError(
                "spaCy model not found. "
                "Run: uv run python -m spacy download en_core_web_sm"
            ) from exc
        return cls(nlp)

    def validate(self, sentence: str, focus_term: str) -> ValidationResult:
        """Applies three rules in order; returns on first failure."""
        doc = self._nlp(sentence)

        # --- Rule 1: whole-word presence (case-insensitive) ---
        if not self._contains_term(doc, focus_term, sentence):
            return ValidationResult(
                valid=False,
                reason="missing_term",
                feedback=f"Sua frase precisa conter a palavra «{focus_term}».",
            )

        # --- Rule 2: verbal ROOT with subject ---
        root = next(
            (t for t in doc if t.dep_ == "ROOT" and t.pos_ in {"VERB", "AUX"}),
            None,
        )
        if root is None or not any(
            c.dep_ in {"nsubj", "nsubjpass"} for c in root.children
        ):
            return ValidationResult(
                valid=False,
                reason="no_subject_verb",
                feedback="A frase parece incompleta — inclua sujeito e verbo.",
            )

        # --- Rule 3: morphological agreement ---
        subj = next(
            c for c in root.children if c.dep_ in {"nsubj", "nsubjpass"}
        )
        verb_morph = root.morph.to_dict()
        subj_morph = subj.morph.to_dict()
        v_number = verb_morph.get("Number")
        s_number = subj_morph.get("Number")
        v_person = verb_morph.get("Person")
        s_person = subj_morph.get("Person")
        if (v_number and s_number and v_number != s_number) or (
            v_person and s_person and v_person != s_person
        ):
            return ValidationResult(
                valid=False,
                reason="agreement_error",
                feedback="Verifique a concordância entre sujeito e verbo.",
            )

        return ValidationResult(valid=True)

    def _contains_term(
        self,
        doc: object,
        focus_term: str,
        sentence: str,
    ) -> bool:
        """Verifies whole-word presence with two paths.

        Path 1: spaCy tokenization (single or multi-token term).
        Path 2: regex fallback for multi-token terms.
        """
        from spacy.tokens import Doc

        if not isinstance(doc, Doc):  # pragma: no cover
            return False

        term_doc = self._nlp(focus_term)
        term_texts = [t.lower_ for t in term_doc if not t.is_space]
        doc_texts = [t.lower_ for t in doc]

        n = len(term_texts)
        if n > 0:
            for i in range(len(doc_texts) - n + 1):
                if doc_texts[i : i + n] == term_texts:
                    return True

        escaped = re.escape(focus_term.lower())
        pattern = re.compile(rf"(?<!\w){escaped}(?!\w)", re.IGNORECASE)
        return bool(pattern.search(sentence))

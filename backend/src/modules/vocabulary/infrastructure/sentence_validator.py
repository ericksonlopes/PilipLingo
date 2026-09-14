"""Validador de frases usando spaCy en_core_web_sm.

Tres regras em sequencia:
1. Presenca whole-word do focus_term (tokenizacao spaCy, case-insensitive).
2. Estrutura sujeito-verbo: ROOT verbal com dependente nsubj/nsubjpass.
3. Concordancia sujeito-verbo: morph Number+Person devem coincidir.

O servico nao depende de FastAPI, SQLAlchemy nem de nenhuma entidade de dominio.
Recebe strings e devolve um dataclass puro.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

import spacy
from spacy.language import Language


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Resultado imutavel de uma validacao de frase."""

    valid: bool
    reason: Literal["missing_term", "no_subject_verb", "agreement_error"] | None = None
    feedback: str | None = None


class SentenceValidatorService:
    """Valida frases em ingles com tres regras linguisticas progressivas.

    Recebe a instancia do modelo spaCy como argumento do construtor para
    permitir injecao de dependencia em testes.
    """

    def __init__(self, nlp: Language) -> None:
        self._nlp = nlp

    @classmethod
    def load(cls) -> SentenceValidatorService:
        """Carrega o modelo en_core_web_sm e devolve uma instancia pronta.

        Falha ruidosamente se o modelo nao estiver instalado, impedindo o
        servidor de subir com configuracao incompleta.
        """
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError as exc:
            raise RuntimeError(
                "Modelo spaCy nao encontrado. "
                "Execute: uv run python -m spacy download en_core_web_sm"
            ) from exc
        return cls(nlp)

    def validate(self, sentence: str, focus_term: str) -> ValidationResult:
        """Aplica as tres regras em ordem; retorna no primeiro erro."""
        doc = self._nlp(sentence)

        # --- Regra 1: presenca whole-word (case-insensitive) ---
        if not self._contains_term(doc, focus_term, sentence):
            return ValidationResult(
                valid=False,
                reason="missing_term",
                feedback=f"Sua frase precisa conter a palavra \u00ab{focus_term}\u00bb.",
            )

        # --- Regra 2: ROOT verbal com sujeito ---
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
                feedback="A frase parece incompleta \u2014 inclua sujeito e verbo.",
            )

        # --- Regra 3: concordancia morfologica (so quando ambos os lados tem features) ---
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
                feedback="Verifique a concordancia entre sujeito e verbo.",
            )

        return ValidationResult(valid=True)

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    def _contains_term(
        self,
        doc: object,
        focus_term: str,
        sentence: str,
    ) -> bool:
        """Verifica presenca whole-word com dois caminhos.

        Caminho 1 — tokenizacao spaCy (termo de um token ou varios): percorre
        a sequencia de tokens e compara janelas de tamanho len(term_tokens).

        Caminho 2 — regex (fallback para termos multi-token que a tokenizacao
        nao alinha perfeitamente, ex.: "look forward to").
        """
        from spacy.tokens import Doc  # local para nao poluir o namespace do modulo

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

        # Fallback regex whole-word para multi-token
        escaped = re.escape(focus_term.lower())
        pattern = re.compile(rf"(?<!\w){escaped}(?!\w)", re.IGNORECASE)
        return bool(pattern.search(sentence))

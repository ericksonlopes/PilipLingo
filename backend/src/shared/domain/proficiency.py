"""Nivel de proficiencia (CEFR).

Fica no shared kernel porque e um conceito transversal do produto: classifica os
termos do vocabulario, calibra as frases geradas pela IA e define o onboarding.
Qualquer fatia nova (progresso, licoes) tende a precisar dele tambem.
"""

from __future__ import annotations

from enum import StrEnum


class ProficiencyLevel(StrEnum):
    """Nivel CEFR aproximado."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"

    @property
    def label(self) -> str:
        return _LABELS[self]

    @property
    def guidance(self) -> str:
        """Descricao usada para calibrar a geracao de frases."""
        return _GUIDANCE[self]


_LABELS: dict[ProficiencyLevel, str] = {
    ProficiencyLevel.A1: "Iniciante",
    ProficiencyLevel.A2: "Basico",
    ProficiencyLevel.B1: "Intermediario",
    ProficiencyLevel.B2: "Intermediario avancado",
    ProficiencyLevel.C1: "Avancado",
    ProficiencyLevel.C2: "Proficiente",
}

_GUIDANCE: dict[ProficiencyLevel, str] = {
    ProficiencyLevel.A1: (
        "Very short sentences (up to 8 words). Present simple only, concrete everyday "
        "topics, the 500 most frequent English words. No idioms, no phrasal verbs."
    ),
    ProficiencyLevel.A2: (
        "Short sentences (up to 12 words). Present, past simple and 'going to'. "
        "Familiar topics like routine, shopping and travel. Very common vocabulary."
    ),
    ProficiencyLevel.B1: (
        "Medium sentences (up to 16 words). Present perfect, conditionals type 1, "
        "common phrasal verbs. Topics like work, studies and personal experiences."
    ),
    ProficiencyLevel.B2: (
        "Longer sentences (up to 22 words) with subordinate clauses. Passive voice, "
        "conditionals type 2, common collocations and some idiomatic language."
    ),
    ProficiencyLevel.C1: (
        "Complex sentences with nuance and connectors. Abstract and professional "
        "topics, idiomatic expressions, precise and less frequent vocabulary."
    ),
    ProficiencyLevel.C2: (
        "Sophisticated, native-like sentences. Register shifts, irony, rare "
        "collocations and highly idiomatic language."
    ),
}

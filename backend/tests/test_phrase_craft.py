"""Unit tests for phrase crafting use case and response schemas."""

from __future__ import annotations

import pytest

from modules.vocabulary.api.schemas import PhraseCraftResponse
from modules.vocabulary.application.craft_phrase import CraftPhrase
from modules.vocabulary.application.dto import PhraseCraftCommand
from modules.vocabulary.domain.errors import SentenceGenerationFailed
from modules.vocabulary.domain.ports import (
    PhraseCrafter,
    PhraseCraftResult,
    PhraseVariation,
    SentencePattern,
)


class FakePhraseCrafter(PhraseCrafter):
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        self.called_with: str | None = None

    async def craft(self, text: str) -> PhraseCraftResult:
        self.called_with = text
        if self.should_fail:
            raise SentenceGenerationFailed("AI provider failure")
        return PhraseCraftResult(
            original=text,
            intent_summary="Pedir ou expressar desejo por pizza",
            cultural_tip=(
                "Em inglês, use 'I'd like' para pedir comida de forma educada, "
                "pois 'I want' soa muito seco."
            ),
            variations=[
                PhraseVariation(
                    english_phrase="I'd like a pizza, please.",
                    portuguese_translation="Eu gostaria de uma pizza, por favor.",
                    context="Restaurante / Pedido educado",
                    formality="Educado",
                    explanation="Forma padrão e educada em restaurantes.",
                ),
                PhraseVariation(
                    english_phrase="I'm in the mood for pizza.",
                    portuguese_translation="Estou a fim de pizza.",
                    context="Vontade espontânea",
                    formality="Natural / Dia a dia",
                    explanation="Expressa desejo ou apetite específico.",
                ),
                PhraseVariation(
                    english_phrase="I could go for some pizza.",
                    portuguese_translation="Cairia bem uma pizza.",
                    context="Casual com amigos",
                    formality="Informal",
                    explanation="Expressão idiomática comum entre amigos.",
                ),
            ],
            patterns=[
                SentencePattern(
                    pattern="I'd like [item], please.",
                    explanation="Estrutura padrão para pedidos educados.",
                    examples=["I'd like a coffee, please.", "I'd like the menu, please."],
                ),
                SentencePattern(
                    pattern="I'm in the mood for [noun / verb-ing].",
                    explanation="Usado para expressar que está com vontade de algo.",
                    examples=["I'm in the mood for Italian food."],
                ),
            ],
        )


@pytest.mark.asyncio
async def test_craft_phrase_use_case_success() -> None:
    crafter = FakePhraseCrafter()
    use_case = CraftPhrase(crafter)

    result = await use_case.execute(PhraseCraftCommand(text="eu quero pizza"))

    assert crafter.called_with == "eu quero pizza"
    assert result.original == "eu quero pizza"
    assert "pizza" in result.intent_summary.lower()
    assert len(result.variations) == 3
    assert result.variations[0].english_phrase == "I'd like a pizza, please."
    assert result.variations[0].formality == "Educado"
    assert len(result.patterns) == 2
    assert "I'd like [item]" in result.patterns[0].pattern

    # Test schema conversion
    response = PhraseCraftResponse.from_result(result)
    assert response.original == "eu quero pizza"
    assert len(response.variations) == 3
    assert response.variations[1].context == "Vontade espontânea"
    assert len(response.patterns) == 2
    assert response.patterns[0].examples == [
        "I'd like a coffee, please.",
        "I'd like the menu, please.",
    ]


@pytest.mark.asyncio
async def test_craft_phrase_use_case_failure() -> None:
    crafter = FakePhraseCrafter(should_fail=True)
    use_case = CraftPhrase(crafter)

    with pytest.raises(SentenceGenerationFailed):
        await use_case.execute(PhraseCraftCommand(text="eu quero pizza"))

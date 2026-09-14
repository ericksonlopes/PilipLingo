"""Adaptador Gemini para o AI_Tutor do chat.

Todo o conhecimento sobre LLM vive aqui. O caso de uso so conhece a porta
ChatAIPort, entao trocar de provedor nao afeta dominio nem aplicacao.
"""

from __future__ import annotations

import logging
import time

from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from modules.chat.domain.entities import (
    MAX_FEEDBACK_CORRECTIONS,
    FeedbackCorrection,
    TurnFeedback,
)
from modules.chat.domain.errors import ChatAIUnavailable
from modules.chat.domain.ports import ChatAIPort, TurnContext, TurnResult

logger = logging.getLogger(__name__)

# ---------- schemas Pydantic para saida estruturada ----------


class _CorrectionItem(BaseModel):
    original: str = Field(description="The original phrase written by the student.")
    corrected: str = Field(description="The corrected version.")
    explanation: str = Field(
        description="Why this correction matters, in Brazilian Portuguese, max 500 chars."
    )


class _FeedbackItem(BaseModel):
    corrections: list[_CorrectionItem] = Field(
        default_factory=list,
        description="Up to 3 grammar or vocabulary corrections.",
    )
    suggestion: str | None = Field(
        default=None,
        description="Optional vocabulary or fluency tip in Brazilian Portuguese, max 280 chars.",
    )


class _TurnResponse(BaseModel):
    """Resposta estruturada do AI_Tutor para um turno."""

    reply: str = Field(description="The AI conversational response in English.")
    feedback: _FeedbackItem | None = Field(
        default=None,
        description="Pedagogical feedback for the student's message.",
    )
    goal_achieved: bool = Field(
        default=False,
        description=(
            "Set to true ONLY when the student has demonstrably achieved the stated Goal "
            "in this turn. Always false for non-GOAL conversations."
        ),
    )


# ---------- prompts ----------

_SYSTEM_PROMPT = """\
You are an AI English tutor in the PilipLingo app helping a Brazilian Portuguese speaker \
practice conversational English.

Conversation mode: {mode}
Student level (CEFR): {level}
{context_line}

Your behavior:
- Respond naturally in English at the student's level.
- Keep replies concise (2-5 sentences for {level} level).
- Gently incorporate corrections into your reply without being condescending.
- In TOPIC mode, keep the conversation on the topic.
- In GOAL mode, steer the conversation toward achieving the goal. \
  Set goal_achieved=true ONLY when the student has clearly demonstrated the goal.
- In FREE mode, be a friendly conversation partner.

Feedback rules:
- Provide up to {max_corrections} corrections per turn.
- Corrections must address real errors only (grammar, word choice, spelling).
- Explanation must be in Brazilian Portuguese, max 500 characters.
- suggestion is optional: use it for a useful vocabulary or fluency tip, max 280 chars, \
  in Brazilian Portuguese.
- If the student message has no errors, return an empty corrections list.
"""

_HISTORY_LINE = "Conversation so far:\n{history}"
_HUMAN_PROMPT = "Student: {user_message}"


class GeminiChatTutor(ChatAIPort):
    """Implementa ChatAIPort usando LangChain + Gemini com saida estruturada."""

    def __init__(self, chat_model: BaseChatModel) -> None:
        self._model_name = getattr(chat_model, "model", "unknown")
        self._chain = ChatPromptTemplate.from_messages(
            [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
        ) | chat_model.with_structured_output(_TurnResponse)

    async def generate_turn(self, context: TurnContext) -> TurnResult:
        history_text = self._format_history(context.history)
        context_line = self._build_context_line(context)

        logger.info(
            "[chat-gemini] chamando API | model=%s level=%s mode=%s",
            self._model_name,
            context.level,
            context.mode,
        )
        t0 = time.monotonic()
        try:
            result = await self._chain.ainvoke(
                {
                    "mode": context.mode,
                    "level": context.level,
                    "context_line": context_line,
                    "max_corrections": MAX_FEEDBACK_CORRECTIONS,
                    "history": history_text if history_text else "(no previous messages)",
                    "user_message": context.user_message,
                }
            )
            elapsed = time.monotonic() - t0
            logger.info("[chat-gemini] resposta recebida em %.1fs", elapsed)
        except Exception as cause:  # noqa: BLE001
            elapsed = time.monotonic() - t0
            logger.warning(
                "[chat-gemini] falha apos %.1fs | %s: %s",
                elapsed,
                type(cause).__name__,
                cause,
            )
            raise ChatAIUnavailable(
                "O provedor de IA nao respondeu como esperado."
            ) from cause

        return self._to_domain(result, context)

    @staticmethod
    def _format_history(history: list[tuple[str, str]]) -> str:
        if not history:
            return ""
        lines: list[str] = []
        for user_msg, ai_msg in history:
            lines.append(f"Student: {user_msg}")
            lines.append(f"AI: {ai_msg}")
        return "\n".join(lines)

    @staticmethod
    def _build_context_line(context: TurnContext) -> str:
        if context.mode == "TOPIC" and context.topic:
            return f"Topic: {context.topic}"
        if context.mode == "GOAL" and context.goal:
            return f"Goal: {context.goal}"
        return ""

    @classmethod
    def _to_domain(cls, result: object, context: TurnContext) -> TurnResult:
        if not isinstance(result, _TurnResponse) or not (result.reply or "").strip():
            raise ChatAIUnavailable("Resposta vazia do provedor de IA.")

        feedback: TurnFeedback | None = None
        if result.feedback is not None:
            try:
                corrections = [
                    FeedbackCorrection(
                        original=c.original[:500],
                        corrected=c.corrected[:500],
                        explanation=c.explanation[:500],
                    )
                    for c in result.feedback.corrections[:MAX_FEEDBACK_CORRECTIONS]
                ]
                suggestion = (
                    result.feedback.suggestion[:280]
                    if result.feedback.suggestion
                    else None
                )
                feedback = TurnFeedback(
                    corrections=corrections,
                    suggestion=suggestion,
                )
            except Exception:  # noqa: BLE001
                logger.warning("[chat-gemini] feedback malformado, ignorando")
                feedback = None

        goal_achieved = (
            bool(result.goal_achieved) if context.evaluate_goal else False
        )

        return TurnResult(
            ai_reply=result.reply.strip(),
            feedback=feedback,
            goal_achieved=goal_achieved,
        )

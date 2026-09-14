"""Erros de dominio especificos da fatia chat."""

from __future__ import annotations

from shared.errors import ConflictError, UnavailableError


class InvalidConversationState(ConflictError):
    """Operacao incompativel com o estado atual da conversa."""

    code = "invalid_state"


class ChatAIUnavailable(UnavailableError):
    """O servico de IA para o chat nao esta disponivel ou configurado."""

    code = "unavailable"

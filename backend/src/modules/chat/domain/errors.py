"""Domain errors specific to chat slice."""

from __future__ import annotations

from shared.errors import ConflictError, UnavailableError


class InvalidConversationState(ConflictError):
    """Operation incompatible with current conversation state."""

    code = "invalid_state"


class ChatAIUnavailable(UnavailableError):
    """AI service for chat is not available or configured."""

    code = "unavailable"

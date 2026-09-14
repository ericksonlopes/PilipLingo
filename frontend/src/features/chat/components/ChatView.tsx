/**
 * Vista principal de conversa ativa.
 * Lista de turnos com scroll, input de mensagem, typing indicator e controles.
 */
import { useEffect, useRef, useState } from "react";

import type { ChatStatus, Conversation, ConversationTurn } from "../../../lib/types";
import TurnBubble from "./TurnBubble";
import TypingIndicator from "./TypingIndicator";

const MAX_MESSAGE_LENGTH = 1000;

interface ChatViewProps {
  conversation: Conversation;
  turns: ConversationTurn[];
  isTyping: boolean;
  chatStatus: ChatStatus | null;
  error: string | null;
  onSend: (text: string) => void;
  onAbandon: () => void;
}

export default function ChatView({
  conversation,
  turns,
  isTyping,
  chatStatus,
  error,
  onSend,
  onAbandon,
}: ChatViewProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mantém o scroll na última mensagem
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [turns, isTyping]);

  function handleSend() {
    const msg = text.trim();
    if (!msg || isTyping || !chatStatus?.enabled) return;
    setText("");
    onSend(msg);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enviar com Enter (sem Shift) em desktop
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const aiDisabled = chatStatus !== null && !chatStatus.enabled;
  const canSend = text.trim().length > 0 && !isTyping && !aiDisabled;

  // Os "pending" são o último turno quando isPending = sem ai_reply
  const pendingTurnIndex = isTyping ? turns.length - 1 : -1;

  return (
    <div className="chat-view">
      {/* Cabeçalho com informações da conversa */}
      <div className="chat-view__header">
        <div className="chat-view__meta">
          <span className="chat-view__mode">{modeLabel(conversation.mode)}</span>
          {conversation.topic && (
            <span className="chat-view__topic">{conversation.topic}</span>
          )}
          {conversation.goal && (
            <span className="chat-view__goal">🎯 {conversation.goal}</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onAbandon}
          aria-label="Encerrar conversa"
        >
          Encerrar
        </button>
      </div>

      {/* Alerta de IA desabilitada */}
      {aiDisabled && (
        <div role="alert" className="alert alert--error chat-view__ai-alert">
          Serviço de IA indisponível. Não é possível enviar mensagens agora.
        </div>
      )}

      {/* Alerta de erro de envio */}
      {error && (
        <div role="alert" className="alert alert--error">
          {error}
        </div>
      )}

      {/* Área de mensagens */}
      <div ref={listRef} className="chat-view__messages">
        {turns.length === 0 && !isTyping && (
          <div className="chat-view__empty">
            <p>Diga olá! Comece a conversa em inglês. 👋</p>
          </div>
        )}
        {turns.map((turn, i) => (
          <TurnBubble
            key={turn.id}
            turn={turn}
            isPending={i === pendingTurnIndex}
          />
        ))}
        {isTyping && <TypingIndicator />}
      </div>

      {/* Input de mensagem */}
      <div className="chat-view__input-area">
        <textarea
          ref={inputRef}
          className="chat-view__input"
          placeholder="Digite em inglês..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          disabled={isTyping || aiDisabled}
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={true}
          aria-label="Mensagem em inglês"
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Enviar mensagem"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M3 12l18-9-9 18-2-7-7-2z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "FREE": return "Conversa Livre";
    case "TOPIC": return "Com Tema";
    case "GOAL": return "Com Meta";
    default: return mode;
  }
}

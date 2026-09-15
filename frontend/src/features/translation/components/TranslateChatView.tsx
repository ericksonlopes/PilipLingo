/**
 * TranslateChatView — interface de chat para tradução contínua.
 *
 * Lista de turnos com scroll automático, input multilinha,
 * Enter para enviar (Shift+Enter = nova linha), botão limpar histórico.
 */
import { useEffect, useRef, useState } from "react";

import type { UseTranslateChatReturn } from "../useTranslateChat";
import TranslateChatBubble from "./TranslateChatBubble";

const MAX_CHARS = 1000;

interface TranslateChatViewProps extends UseTranslateChatReturn {}

export default function TranslateChatView({
  turns,
  isTyping,
  sendMessage,
  clearHistory,
}: TranslateChatViewProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll para o final sempre que chegam novos turnos
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [turns, isTyping]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_CHARS && !isTyping;

  async function handleSend() {
    if (!canSend) return;
    const msg = trimmed;
    setText("");
    inputRef.current?.focus();
    await sendMessage(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="tc-view">
      {/* Header com ação de limpar */}
      <div className="tc-view__header">
        <p className="tc-view__hint">
          Digite em inglês ou português — cada mensagem gera uma tradução com análise.
        </p>
        {turns.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={clearHistory}
            aria-label="Limpar histórico de traduções"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Lista de turnos */}
      <div
        ref={listRef}
        className="tc-view__messages"
        aria-live="polite"
        aria-label="Histórico de traduções"
      >
        {turns.length === 0 && (
          <div className="tc-view__empty">
            <p>Comece digitando uma frase abaixo. 💬</p>
          </div>
        )}
        {turns.map((turn) => (
          <TranslateChatBubble key={turn.id} turn={turn} />
        ))}
      </div>

      {/* Input */}
      <div className="tc-view__input-area">
        <textarea
          ref={inputRef}
          className="tc-view__input"
          placeholder="Digite em inglês ou português..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_CHARS + 1}
          rows={2}
          disabled={isTyping}
          enterKeyHint="send"
          autoCorrect="off"
          spellCheck={true}
          aria-label="Frase para traduzir"
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Traduzir"
        >
          {/* Ícone de envio */}
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

      <p className="setup-note">
        <kbd>Enter</kbd> envia · <kbd>Shift+Enter</kbd> nova linha
      </p>
    </div>
  );
}

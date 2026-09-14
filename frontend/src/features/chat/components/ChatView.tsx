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
  onComplete?: () => void;
}

export default function ChatView({
  conversation,
  turns,
  isTyping,
  chatStatus,
  error,
  onSend,
  onAbandon,
  onComplete,
}: ChatViewProps) {
  const [text, setText] = useState("");
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
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

  const goals = conversation.goals || [];
  const goalsProgress = conversation.goals_progress || [];
  const achievedCount = goalsProgress.filter(Boolean).length;
  const allGoalsAchieved =
    goals.length > 0 &&
    (achievedCount === goals.length || conversation.goal_status === "achieved");

  const showCompletionModal = allGoalsAchieved && !dismissedPrompt;

  function handleEndChat() {
    if (onComplete) {
      onComplete();
    } else {
      onAbandon();
    }
  }

  return (
    <div className="chat-view">
      {/* Cabeçalho com informações da conversa */}
      <div className="chat-view__header">
        <div className="chat-view__meta">
          <div className="chat-view__meta-top">
            <span className="chat-view__mode">{modeLabel(conversation.mode)}</span>
            {allGoalsAchieved && (
              <span className="chat-view__badge-completed">3/3 Concluídas ✓</span>
            )}
          </div>
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
          onClick={allGoalsAchieved && onComplete ? onComplete : onAbandon}
          aria-label="Encerrar conversa"
        >
          Encerrar
        </button>
      </div>

      {/* Painel de metas em tempo real (modo GOAL) */}
      {goals.length > 0 && (
        <div className="chat-goals-bar" aria-label="Progresso das metas">
          <div className="chat-goals-bar__header">
            <span className="chat-goals-bar__title">
              🎯 Metas a descobrir ({achievedCount}/{goals.length})
            </span>
            <div className="chat-goals-bar__meter">
              <div
                className="chat-goals-bar__meter-fill"
                style={{ width: `${(achievedCount / goals.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="chat-goals-bar__pills">
            {goals.map((g, idx) => {
              const isDone = Boolean(goalsProgress[idx]);
              return (
                <div
                  key={idx}
                  className={`chat-goal-pill ${isDone ? "chat-goal-pill--done" : ""}`}
                >
                  <span className="chat-goal-pill__check">
                    {isDone ? "✓" : "○"}
                  </span>
                  <span className="chat-goal-pill__text">{g}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Modal / Card comemorativo ao atingir todas as metas */}
      {showCompletionModal && (
        <div className="chat-goals-modal-overlay" role="dialog" aria-modal="true">
          <div className="chat-goals-modal">
            <div className="chat-goals-modal__icon" aria-hidden="true">🎉</div>
            <h3 className="chat-goals-modal__title">Todas as metas concluídas!</h3>
            <p className="chat-goals-modal__subtitle">
              Você conseguiu extrair todas as informações da conversa:
            </p>
            <ul className="chat-goals-modal__list" role="list">
              {goals.map((g, idx) => (
                <li key={idx} className="chat-goals-modal__item">
                  <span className="chat-goals-modal__check" aria-hidden="true">✓</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
            <p className="chat-goals-modal__question">
              Deseja continuar conversando em inglês ou encerrar o chat?
            </p>
            <div className="chat-goals-modal__actions">
              <button
                type="button"
                className="btn btn--secondary chat-goals-modal__btn"
                onClick={() => setDismissedPrompt(true)}
              >
                Continuar conversando
              </button>
              <button
                type="button"
                className="btn btn--primary chat-goals-modal__btn"
                onClick={handleEndChat}
              >
                Encerrar o chat
              </button>
            </div>
          </div>
        </div>
      )}
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

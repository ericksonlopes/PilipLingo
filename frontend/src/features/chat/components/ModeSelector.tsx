/**
 * Tela de seleção de modalidade de conversa.
 * Exibe três cards: Livre, Tema e Meta.
 */
import type { ConversationMode } from "../../../lib/types";

interface ModeSelectorProps {
  onSelectMode: (mode: ConversationMode) => void;
  onStartFree: () => void;
  disabled?: boolean;
}

interface ModeCardDef {
  mode: ConversationMode;
  label: string;
  description: string;
  icon: string;
}

const MODES: ModeCardDef[] = [
  {
    mode: "FREE",
    label: "Conversa Livre",
    description: "Pratica livre sem roteiro. A IA responde e corrige discretamente.",
    icon: "💬",
  },
  {
    mode: "TOPIC",
    label: "Conversa com Tema",
    description: "Escolha um tópico pré-definido e fique focado nele.",
    icon: "🗂️",
  },
  {
    mode: "GOAL",
    label: "Conversa com Meta",
    description: "Defina um objetivo comunicativo e saiba quando você o atingiu.",
    icon: "🎯",
  },
];

export default function ModeSelector({
  onSelectMode,
  onStartFree,
  disabled = false,
}: ModeSelectorProps) {
  function handleClick(mode: ConversationMode) {
    if (disabled) return;
    if (mode === "FREE") {
      onStartFree();
    } else {
      onSelectMode(mode);
    }
  }

  return (
    <div className="chat-mode-selector">
      <h2 className="chat-mode-selector__title">Como quer praticar hoje?</h2>
      <p className="chat-mode-selector__subtitle">
        Escolha a modalidade para iniciar a conversa com a IA.
      </p>
      <ul className="chat-mode-list" role="list">
        {MODES.map((m) => (
          <li key={m.mode}>
            <button
              type="button"
              className="chat-mode-card"
              onClick={() => handleClick(m.mode)}
              disabled={disabled}
              aria-label={m.label}
            >
              <span className="chat-mode-card__icon" aria-hidden="true">
                {m.icon}
              </span>
              <span className="chat-mode-card__body">
                <span className="chat-mode-card__label">{m.label}</span>
                <span className="chat-mode-card__desc">{m.description}</span>
              </span>
              <svg
                className="chat-mode-card__arrow"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

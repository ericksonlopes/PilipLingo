/**
 * Tela de seleção de tópico para modalidade TOPIC.
 */
import type { ChatTopic, ProficiencyLevel } from "../../../lib/types";

interface TopicSelectorProps {
  topics: ChatTopic[];
  userLevel: ProficiencyLevel;
  onSelect: (topic: string) => void;
  onBack: () => void;
  loading?: boolean;
}

export default function TopicSelector({
  topics,
  userLevel,
  onSelect,
  onBack,
  loading = false,
}: TopicSelectorProps) {
  if (topics.length === 0 && !loading) {
    return (
      <div className="chat-selector">
        <button
          type="button"
          className="btn btn--ghost btn--sm chat-selector__back"
          onClick={onBack}
          aria-label="Voltar"
        >
          ← Voltar
        </button>
        <div className="empty">
          <p className="empty__title">Tópicos indisponíveis</p>
          <p className="empty__text">
            Não há tópicos disponíveis no momento. Tente a modalidade Livre.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-selector">
      <button
        type="button"
        className="btn btn--ghost btn--sm chat-selector__back"
        onClick={onBack}
        aria-label="Voltar para seleção de modalidade"
      >
        ← Voltar
      </button>
      <h2 className="chat-selector__title">Escolha um tópico</h2>
      <p className="chat-selector__subtitle">
        Tópicos marcados com seu nível são mais adequados para você.
      </p>
      <ul className="chat-item-list" role="list">
        {topics.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="chat-item-card"
              onClick={() => onSelect(t.label)}
            >
              <span className="chat-item-card__body">
                <span className="chat-item-card__label">
                  {t.label}
                  {t.level_hint !== userLevel && (
                    <span className={`level level--${t.level_hint.toLowerCase()}`}>
                      {t.level_hint}
                    </span>
                  )}
                </span>
                <span className="chat-item-card__desc">{t.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

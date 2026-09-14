/**
 * Tela exibida quando a conversa termina (completed ou abandoned).
 */
interface CompletedViewProps {
  goalAchieved?: boolean;
  goals?: string[];
  turnCount: number;
  onNewConversation: () => void;
}

export default function CompletedView({
  goalAchieved = false,
  goals = [],
  turnCount,
  onNewConversation,
}: CompletedViewProps) {
  return (
    <div className="chat-completed">
      <div className="chat-completed__icon" aria-hidden="true">
        {goalAchieved ? "🏆" : "✅"}
      </div>
      <h2 className="chat-completed__title">
        {goalAchieved ? "Metas atingidas com sucesso!" : "Conversa encerrada"}
      </h2>
      <p className="chat-completed__text">
        {goalAchieved
          ? "Parabéns! Você conseguiu extrair todas as informações e completou sua missão comunicativa."
          : `Você praticou por ${turnCount} ${turnCount === 1 ? "turno" : "turnos"}.`}
      </p>

      {goalAchieved && goals.length > 0 && (
        <div className="chat-completed__goals-card">
          <span className="chat-completed__goals-title">🎯 Informações descobertas:</span>
          <ul className="chat-completed__goals-list" role="list">
            {goals.map((g, i) => (
              <li key={i} className="chat-completed__goal-item">
                <span className="chat-completed__goal-check" aria-hidden="true">✓</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={onNewConversation}
      >
        Nova conversa
      </button>
    </div>
  );
}

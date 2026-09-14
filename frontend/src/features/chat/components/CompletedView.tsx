/**
 * Tela exibida quando a conversa termina (completed ou abandoned).
 */
interface CompletedViewProps {
  goalAchieved?: boolean;
  turnCount: number;
  onNewConversation: () => void;
}

export default function CompletedView({
  goalAchieved = false,
  turnCount,
  onNewConversation,
}: CompletedViewProps) {
  return (
    <div className="chat-completed">
      <div className="chat-completed__icon" aria-hidden="true">
        {goalAchieved ? "🏆" : "✅"}
      </div>
      <h2 className="chat-completed__title">
        {goalAchieved ? "Meta atingida!" : "Conversa encerrada"}
      </h2>
      <p className="chat-completed__text">
        {goalAchieved
          ? "Parabéns! Você atingiu seu objetivo comunicativo."
          : `Você praticou por ${turnCount} ${turnCount === 1 ? "turno" : "turnos"}.`}
      </p>
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

/**
 * Exibe um par de bolhas (usuário + IA) com feedback opcional colapsável.
 */
import type { ConversationTurn } from "../../../lib/types";
import FeedbackAccordion from "./FeedbackAccordion";

interface TurnBubbleProps {
  turn: ConversationTurn;
  /** Turno ainda sendo enviado (mensagem do usuário apenas, sem reply) */
  isPending?: boolean;
}

export default function TurnBubble({ turn, isPending = false }: TurnBubbleProps) {
  return (
    <div className="turn-pair">
      {/* Bolha do usuário */}
      <div className="chat-bubble chat-bubble--user">
        <p className="chat-bubble__text">{turn.user_message}</p>
      </div>

      {/* Feedback pedagógico (colapsável, abaixo da bolha do usuário) */}
      {turn.feedback && <FeedbackAccordion feedback={turn.feedback} />}

      {/* Bolha da IA (não exibida enquanto isPending) */}
      {!isPending && turn.ai_reply && (
        <div className="chat-bubble chat-bubble--ai">
          <p className="chat-bubble__text">{turn.ai_reply}</p>
        </div>
      )}
    </div>
  );
}

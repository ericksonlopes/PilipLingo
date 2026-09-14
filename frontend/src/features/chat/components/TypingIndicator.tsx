/**
 * Animação de "IA está digitando..." exibida enquanto aguarda resposta.
 */
export default function TypingIndicator() {
  return (
    <div className="chat-bubble chat-bubble--ai" aria-live="polite" aria-label="IA está digitando">
      <div className="typing-indicator">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </div>
    </div>
  );
}

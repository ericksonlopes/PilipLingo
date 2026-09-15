import { useEffect, useMemo, useState } from "react";

import { ApiError, vocabularyApi } from "../../lib/api";
import { detectTypos } from "../../lib/answers";
import { speak } from "../../lib/speech";
import type { StudyExercise } from "../../lib/types";
import ActionBarSlot from "./ActionBarSlot";


interface SentenceBuilderProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

/**
 * Mode 6: Free-form sentence builder.
 */
export default function SentenceBuilder({
  exercise,
  isResolved,
  onResolve,
}: SentenceBuilderProps) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (isResolved && wasCorrect === true && text.trim()) {
      void speak(text.trim());
    }
  }, [isResolved]);

  const isBlank = !text.trim();
  const submitDisabled = isBlank || validating || isResolved;

  const referenceWords = useMemo(() => {
    const parts: string[] = [];
    if (exercise.card.sentence) parts.push(...exercise.card.sentence.split(/\s+/));
    if (exercise.prompt) parts.push(...exercise.prompt.split(/\s+/));
    return parts;
  }, [exercise.card.sentence, exercise.prompt]);

  const typos = useMemo(
    () => (isResolved || isBlank ? [] : detectTypos(text, referenceWords)),
    [text, referenceWords, isResolved, isBlank],
  );

  async function handleSubmit() {
    if (submitDisabled) return;

    setValidating(true);
    setNetworkError(false);
    setFeedback(null);

    try {
      const result = await vocabularyApi.validateSentenceBuilder(
        text,
        exercise.prompt,
      );
      setWasCorrect(result.valid);
      if (!result.valid) {
        setFeedback(result.feedback);
      }
      onResolve(result.valid);
    } catch (err) {
      const isNetworkOrServer =
        err instanceof ApiError && (err.status === 0 || err.status >= 500);
      if (isNetworkOrServer || !(err instanceof ApiError)) {
        setNetworkError(true);
      } else {
        setNetworkError(true);
      }
    } finally {
      setValidating(false);
    }
  }

  function handleRetry() {
    setNetworkError(false);
    setFeedback(null);
  }

  return (
    <div className="exercise">
      <p className="exercise__sentence" lang="en">
        {exercise.prompt}
      </p>

      {exercise.card.focus_term_translation != null ? (
        <p className="exercise__hint sentence-builder__term-translation">
          {exercise.card.focus_term_translation}
        </p>
      ) : exercise.card.translation ? (
        <p className="exercise__hint sentence-builder__term-translation">
          Tradução da frase: {exercise.card.translation}
        </p>
      ) : null}

      {!isResolved ? (
        <div className="sentence-builder__hint-row">
          <button
            type="button"
            className="btn btn--ghost sentence-builder__hint-btn"
            onClick={() => setHintVisible((v) => !v)}
            aria-expanded={hintVisible}
            aria-controls="sentence-builder-hint"
          >
            {hintVisible ? "Esconder dica" : "Ver dica"}
          </button>
          {hintVisible ? (
            <div id="sentence-builder-hint" className="sentence-builder__hint-box" role="note">
              <span className="sentence-builder__hint-label">Exemplo:</span>
              <span className="sentence-builder__hint-text" lang="en">
                {exercise.card.sentence}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <textarea
        className="field__input sentence-builder__textarea"
        aria-label="Escreva sua frase em inglês"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={validating || isResolved}
        rows={3}
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Digite uma frase em inglês…"
      />

      {typos.length > 0 && !isResolved && (
        <div className="spell-hint" role="status" aria-live="polite">
          <span className="spell-hint__icon" aria-hidden="true">✏️</span>
          <span className="spell-hint__text">
            Você quis dizer{" "}
            {typos.map((t, i) => (
              <span key={t.original}>
                {i > 0 && ", "}
                <span className="spell-hint__pair">
                  <span className="spell-hint__wrong" lang="en">{t.original}</span>
                  {" → "}
                  <strong className="spell-hint__suggestion" lang="en">{t.suggestion}</strong>
                </span>
              </span>
            ))}
            ?
          </span>
        </div>
      )}

      {networkError ? (
        <div className="exercise__feedback" role="alert">
          <p className="feedback feedback--bad">
            Não foi possível validar a frase. Verifique sua conexão.
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleRetry}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {!networkError && feedback != null ? (
        <div className="exercise__feedback" role="alert">
          <p className="feedback feedback--bad">{feedback}</p>
        </div>
      ) : null}

      {isResolved && wasCorrect === true && !networkError ? (
        <div className="exercise__feedback">
          <p className="feedback feedback--ok">Muito bem!</p>
          <button
            type="button"
            className="sentence-builder__replay"
            onClick={() => void speak(text.trim())}
            title="Clique para ouvir sua frase"
            aria-label="Ouvir sua frase"
          >
            <div className="sentence-builder__replay-header">
              <span className="exercise__hint">Sua frase:</span>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
                focusable="false"
                className="sentence-builder__replay-icon"
              >
                <path
                  d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M15.5 9c1.2 1 1.2 5 0 6M18 6.5c2.2 2 2.2 9 0 11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="sentence-builder__student-sentence" lang="en">
              {text.trim()}
            </span>
          </button>
        </div>
      ) : null}

      {!isResolved ? (
        <ActionBarSlot>
          <div className="exercise__actions">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => void handleSubmit()}
              disabled={submitDisabled}
              aria-busy={validating}
            >
              {validating ? "Verificando…" : "Verificar"}
            </button>
          </div>
        </ActionBarSlot>
      ) : null}

      {isResolved ? (
        <div className="exercise__feedback">
          <p className="exercise__hint">Exemplo do card:</p>
          <p className="exercise__sentence" lang="en">
            {exercise.card.sentence}
          </p>
        </div>
      ) : null}
    </div>
  );
}

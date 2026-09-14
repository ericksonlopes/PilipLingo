import { useEffect, useState } from "react";

import { ApiError, vocabularyApi } from "../../lib/api";
import { speak } from "../../lib/speech";
import type { StudyExercise } from "../../lib/types";
import AudioButton from "./AudioButton";

interface SentenceBuilderProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

/**
 * Modo 6: o aluno escreve livremente uma frase em ingles usando o focus_term.
 *
 * A validacao e feita no backend via spaCy (tres regras: presenca do termo,
 * estrutura sujeito-verbo e concordancia morfologica). O componente so chama
 * onResolve apos receber a resposta do servidor; erro de rede nunca avanca o
 * exercicio.
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

  // Ao resolver com acerto, reproduz a frase que o aluno criou.
  useEffect(() => {
    if (isResolved && wasCorrect === true && text.trim()) {
      void speak(text.trim());
    }
  // Só dispara quando isResolved muda para true — não re-executa em re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResolved]);

  const isBlank = !text.trim();
  const submitDisabled = isBlank || validating || isResolved;

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
        // 422 ou outro erro HTTP inesperado: trata como erro generico de rede
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
      {/* Termo-alvo: elemento visual principal */}
      <p className="exercise__sentence" lang="en">
        {exercise.prompt}
      </p>

      {/* Traducao do termo (label secundario, so quando disponivel) */}
      {exercise.card.focus_term_translation != null ? (
        <p className="exercise__hint">{exercise.card.focus_term_translation}</p>
      ) : null}

      {/* Botão de dica — mostra a frase de exemplo do card antes de resolver */}
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

      {/* Campo de escrita */}
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

      {/* Erro de rede */}
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

      {/* Feedback de validacao (invalido) — so quando nao esta em erro de rede */}
      {!networkError && feedback != null ? (
        <div className="exercise__feedback" role="alert">
          <p className="feedback feedback--bad">{feedback}</p>
        </div>
      ) : null}

      {/* Feedback de sucesso — so apos resolucao correta */}
      {isResolved && wasCorrect === true && !networkError ? (
        <div className="exercise__feedback">
          <p className="feedback feedback--ok">Muito bem!</p>
          {/* Reproduz a frase que o aluno criou — o speak() inicial é no useEffect */}
          <div className="sentence-builder__replay">
            <span className="exercise__hint">Sua frase:</span>
            <span className="sentence-builder__student-sentence" lang="en">{text.trim()}</span>
            <AudioButton text={text.trim()} label="Ouvir sua frase" />
          </div>
        </div>
      ) : null}

      {/* Botao de submissao */}
      {!isResolved ? (
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
      ) : null}

      {/* Frase de exemplo exibida apos resolucao */}
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

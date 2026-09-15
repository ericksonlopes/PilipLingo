import { useState } from "react";

import { useTypingPreference } from "../../hooks/useTypingPreference";
import { isCloseAnswer, isExactAnswer } from "../../lib/answers";
import type { StudyExercise } from "../../lib/types";
import ActionBarSlot from "./ActionBarSlot";
import AudioButton from "./AudioButton";

interface BlockAssemblyProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

function IconKeyboard() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
    </svg>
  );
}

function IconBlocks() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="8" height="6" rx="1.5" />
      <rect x="14" y="7" width="8" height="6" rx="1.5" />
      <path d="M10 10h4" />
      <path d="M5 17h14" />
    </svg>
  );
}

/**
 * Modos 2 e 3: o aluno monta a frase tocando em blocos OU digitando com o teclado.
 * A alternância é feita exclusivamente pelo botão ao lado de "Ouvir de novo".
 */
export default function BlockAssembly({ exercise, isResolved, onResolve }: BlockAssemblyProps) {
  const { inputMode, toggle } = useTypingPreference();
  const isDictation = exercise.mode === "AUDIO_DICTATION";

  return (
    <div className="exercise">
      <div className="block-assembly__top">
        {isDictation ? (
          <AudioButton text={exercise.card.sentence} label="Ouvir de novo" />
        ) : (
          <p className="exercise__sentence exercise__sentence--source">{exercise.prompt}</p>
        )}

        {!isResolved && (
          <button
            type="button"
            className="block-assembly__icon-toggle"
            onClick={toggle}
            title={inputMode === "blocks" ? "Digitar no teclado" : "Montar com blocos"}
            aria-label={inputMode === "blocks" ? "Digitar no teclado" : "Montar com blocos"}
          >
            {inputMode === "blocks" ? <IconKeyboard /> : <IconBlocks />}
          </button>
        )}
      </div>

      {inputMode === "typing" ? (
        <TypingAnswer
          exercise={exercise}
          isResolved={isResolved}
          onResolve={onResolve}
        />
      ) : (
        <BlocksAnswer
          exercise={exercise}
          isResolved={isResolved}
          onResolve={onResolve}
        />
      )}
    </div>
  );
}

/** Resposta por teclado: o aluno escreve a frase inteira. */
function TypingAnswer({ exercise, isResolved, onResolve }: BlockAssemblyProps) {
  const [value, setValue] = useState("");
  const isDictation = exercise.mode === "AUDIO_DICTATION";
  const wasCorrect = isExactAnswer(value, exercise.answer);
  const wasClose = !wasCorrect && isCloseAnswer(value, exercise.answer);

  function check() {
    if (!isResolved && value.trim()) {
      onResolve(wasCorrect);
    }
  }

  return (
    <>
      <label className="field">
        <span className="field__label">
          {isDictation ? "Escreva a frase que ouviu" : "Escreva a frase em inglês"}
        </span>
        <input
          className="field__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") check();
          }}
          disabled={isResolved}
          lang="en"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Digite a frase em inglês"
        />
      </label>

      {isResolved ? (
        <div className="exercise__feedback">
          <p className={wasCorrect ? "feedback feedback--ok" : "feedback feedback--bad"}>
            {wasCorrect ? "Frase certa." : exercise.answer}
          </p>
          {!wasCorrect && wasClose && (
            <p className="feedback feedback--close">
              Quase! Você escreveu <strong lang="en">"{value.trim()}"</strong>.
            </p>
          )}
          {isDictation ? <p className="exercise__hint">{exercise.card.translation}</p> : null}
          <AudioButton text={exercise.card.sentence} label="Ouvir a frase" />
        </div>
      ) : (
        <ActionBarSlot>
          <div className="exercise__actions">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={check}
              disabled={!value.trim()}
            >
              Verificar
            </button>
          </div>
        </ActionBarSlot>
      )}
    </>
  );
}

/** Resposta por blocos: o aluno toca nos blocos para montar a frase. */
function BlocksAnswer({ exercise, isResolved, onResolve }: BlockAssemblyProps) {
  const [picked, setPicked] = useState<number[]>([]);
  const isDictation = exercise.mode === "AUDIO_DICTATION";

  const attempt = picked.map((position) => exercise.blocks[position] ?? "").join(" ");
  const wasCorrect = isExactAnswer(attempt, exercise.answer);
  const available = exercise.blocks
    .map((_, position) => position)
    .filter((position) => !picked.includes(position));

  return (
    <>
      <div className="blocks blocks--answer" aria-label="Sua resposta">
        {picked.length === 0 ? (
          <p className="blocks__placeholder">Toque nos blocos abaixo para montar a frase.</p>
        ) : (
          picked.map((position, order) => (
            <button
              type="button"
              className="block block--picked"
              key={`picked-${position}-${order}`}
              onClick={() =>
                setPicked((current) => current.filter((_, index) => index !== order))
              }
              disabled={isResolved}
            >
              {exercise.blocks[position]}
            </button>
          ))
        )}
      </div>

      <div className="blocks" aria-label="Blocos disponiveis">
        {available.map((position) => (
          <button
            type="button"
            className="block"
            key={`bank-${position}`}
            onClick={() => setPicked((current) => [...current, position])}
            disabled={isResolved}
          >
            {exercise.blocks[position]}
          </button>
        ))}
      </div>

      {isResolved ? (
        <div className="exercise__feedback">
          <p className={wasCorrect ? "feedback feedback--ok" : "feedback feedback--bad"}>
            {wasCorrect ? "Frase montada certa." : exercise.answer}
          </p>
          {isDictation ? <p className="exercise__hint">{exercise.card.translation}</p> : null}
          <AudioButton text={exercise.card.sentence} label="Ouvir a frase" />
        </div>
      ) : (
        <>
          {/* Limpar fica no card, junto dos blocos. */}
          <div className="exercise__actions exercise__actions--inline">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPicked([])}
              disabled={picked.length === 0}
            >
              Limpar
            </button>
          </div>

          {/* Verificar (acao primaria) vai para a barra fixa do rodape. */}
          <ActionBarSlot>
            <div className="exercise__actions">
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => onResolve(wasCorrect)}
                disabled={available.length > 0}
              >
                Verificar
              </button>
            </div>
          </ActionBarSlot>
        </>
      )}
    </>
  );
}

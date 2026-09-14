import { useState } from "react";

import { isCloseAnswer, isExactAnswer } from "../../lib/answers";
import type { StudyExercise } from "../../lib/types";
import AudioButton from "./AudioButton";

interface TypingClozeProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

const PLACEHOLDER = "____";

/** Modo 1: a frase aparece com uma lacuna e o aluno digita a palavra que falta. */
export default function TypingCloze({ exercise, isResolved, onResolve }: TypingClozeProps) {
  const [value, setValue] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [before, after] = splitPrompt(exercise.prompt);
  const wasCorrect = hintsUsed === 0 && isExactAnswer(value, exercise.answer);
  const wasClose = !wasCorrect && isCloseAnswer(value, exercise.answer);

  function check() {
    if (!isResolved && value.trim()) {
      onResolve(wasCorrect);
    }
  }

  function revealNextLetter() {
    const next = exercise.answer.slice(0, value.length + 1);
    setValue(next);
    setHintsUsed((n) => n + 1);
  }

  const hintDone = value.length >= exercise.answer.length;

  return (
    <div className="exercise">
      <p className="exercise__sentence">
        {before}
        <span className={`cloze${isResolved ? " cloze--filled" : ""}`}>
          {isResolved ? exercise.answer : PLACEHOLDER}
        </span>
        {after}
      </p>

      <p className="exercise__hint">{exercise.card.translation}</p>

      <label className="field">
        <span className="field__label">Palavra que falta</span>
        <input
          className="field__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") check();
          }}
          disabled={isResolved}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Digite a palavra que completa a frase"
        />
      </label>

      {isResolved ? (
        <div className="exercise__feedback">
          <p className={wasCorrect ? "feedback feedback--ok" : "feedback feedback--bad"}>
            {wasCorrect ? "Isso mesmo." : `Era "${exercise.answer}".`}
          </p>
          {!wasCorrect && wasClose && (
            <p className="feedback feedback--close">
              Quase! Você digitou <strong lang="en">"{value.trim()}"</strong>, a resposta era{" "}
              <strong lang="en">"{exercise.answer}"</strong>.
            </p>
          )}
          <AudioButton text={exercise.card.sentence} label="Ouvir a frase" />
        </div>
      ) : (
        <div className="exercise__actions">
          <button
            type="button"
            className="btn btn--ghost btn--hint"
            onClick={revealNextLetter}
            disabled={hintDone}
            aria-label="Dica: revelar próxima letra"
            title="Dica"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="16" height="16">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 17v-1M12 13.5c0-1.5 2-2 2-3.5a2 2 0 1 0-4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {hintsUsed > 0 ? (
              <span className="btn__hint-progress">
                {value.length}/{exercise.answer.length}
              </span>
            ) : (
              "Dica"
            )}
          </button>

          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={check}
            disabled={!value.trim()}
          >
            Verificar
          </button>
        </div>
      )}
    </div>
  );
}

function splitPrompt(prompt: string): [string, string] {
  const position = prompt.indexOf(PLACEHOLDER);
  if (position < 0) {
    return [prompt, ""];
  }
  return [prompt.slice(0, position), prompt.slice(position + PLACEHOLDER.length)];
}

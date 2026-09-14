import { useState } from "react";

import { useTypingPreference } from "../../hooks/useTypingPreference";
import { isCloseAnswer, isExactAnswer } from "../../lib/answers";
import type { StudyExercise } from "../../lib/types";
import AudioButton from "./AudioButton";

interface BlockAssemblyProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

/**
 * Modos 2 e 3: o aluno monta a frase tocando em blocos OU digitando com o teclado.
 *
 * `AUDIO_DICTATION` da so o audio e blocos de palavras soltas. `BLOCK_TRANSLATION`
 * da a frase em portugues e blocos maiores, que sao os proprios chunks da analise
 * estrutural: ordenar "[I've been] [looking forward to] [this moment]" e um passo
 * mais perto de entender a construcao do que ordenar palavra por palavra.
 *
 * Quem prefere teclado pode alternar para digitar a frase inteira: a correcao
 * usa a mesma `answer` que ja vem do backend (comparacao exata + "quase certo").
 * A preferencia vale para a sessao toda.
 *
 * Os blocos sao rastreados por posicao, nao por texto, porque a mesma palavra
 * pode aparecer duas vezes na frase.
 */
export default function BlockAssembly({ exercise, isResolved, onResolve }: BlockAssemblyProps) {
  const { inputMode, toggle } = useTypingPreference();
  const isDictation = exercise.mode === "AUDIO_DICTATION";

  return (
    <div className="exercise">
      {isDictation ? (
        <AudioButton text={exercise.card.sentence} label="Ouvir de novo" />
      ) : (
        <p className="exercise__sentence exercise__sentence--source">{exercise.prompt}</p>
      )}

      {isDictation ? <AudioButton text={exercise.card.sentence} label="Devagar" slow /> : null}

      {!isResolved && (
        <div className="input-mode" role="group" aria-label="Como responder">
          <button
            type="button"
            className={`input-mode__option${inputMode === "blocks" ? " input-mode__option--on" : ""}`}
            onClick={() => inputMode !== "blocks" && toggle()}
            aria-pressed={inputMode === "blocks"}
          >
            Blocos
          </button>
          <button
            type="button"
            className={`input-mode__option${inputMode === "typing" ? " input-mode__option--on" : ""}`}
            onClick={() => inputMode !== "typing" && toggle()}
            aria-pressed={inputMode === "typing"}
          >
            Digitar
          </button>
        </div>
      )}

      {inputMode === "typing" ? (
        <TypingAnswer exercise={exercise} isResolved={isResolved} onResolve={onResolve} />
      ) : (
        <BlocksAnswer exercise={exercise} isResolved={isResolved} onResolve={onResolve} />
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
        <div className="exercise__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setPicked([])}
            disabled={picked.length === 0}
          >
            Limpar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onResolve(wasCorrect)}
            disabled={available.length > 0}
          >
            Verificar
          </button>
        </div>
      )}
    </>
  );
}

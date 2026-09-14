import { useState } from "react";

import { isExactAnswer } from "../../lib/answers";
import type { StudyExercise } from "../../lib/types";
import AudioButton from "./AudioButton";

interface BlockAssemblyProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

/**
 * Modos 2 e 3: o aluno monta a frase tocando em blocos.
 *
 * `AUDIO_DICTATION` da so o audio e blocos de palavras soltas. `BLOCK_TRANSLATION`
 * da a frase em portugues e blocos maiores, que sao os proprios chunks da analise
 * estrutural: ordenar "[I've been] [looking forward to] [this moment]" e um passo
 * mais perto de entender a construcao do que ordenar palavra por palavra.
 *
 * Os blocos sao rastreados por posicao, nao por texto, porque a mesma palavra
 * pode aparecer duas vezes na frase.
 */
export default function BlockAssembly({ exercise, isResolved, onResolve }: BlockAssemblyProps) {
  const [picked, setPicked] = useState<number[]>([]);
  const isDictation = exercise.mode === "AUDIO_DICTATION";

  const attempt = picked.map((position) => exercise.blocks[position] ?? "").join(" ");
  const wasCorrect = isExactAnswer(attempt, exercise.answer);
  const available = exercise.blocks
    .map((_, position) => position)
    .filter((position) => !picked.includes(position));

  return (
    <div className="exercise">
      {isDictation ? (
        <AudioButton text={exercise.card.sentence} label="Ouvir de novo" />
      ) : (
        <p className="exercise__sentence exercise__sentence--source">{exercise.prompt}</p>
      )}

      {isDictation ? <AudioButton text={exercise.card.sentence} label="Devagar" slow /> : null}

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
    </div>
  );
}

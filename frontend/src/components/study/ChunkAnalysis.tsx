import { useId, useState } from "react";

import type { StudyCard } from "../../lib/types";

interface ChunkAnalysisProps {
  card: StudyCard;
}

/**
 * Analise Estrutural: mostra como a frase foi montada, bloco por bloco.
 *
 * Fica fechada por padrao e aparece em qualquer um dos cinco modos, depois de o
 * aluno responder. A ideia e trocar a traducao palavra por palavra pela nocao de
 * que a frase e feita de pecas com funcao propria.
 *
 * Sem blocos utilizaveis nao renderiza nada: e melhor nao ter o botao do que ter
 * um botao que abre vazio.
 */
export default function ChunkAnalysis({ card }: ChunkAnalysisProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  if (card.sentence_chunks.length === 0) {
    return null;
  }

  return (
    <div className="chunks">
      <button
        type="button"
        className="chunks__toggle-btn"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="chunks__toggle-label">
          <span aria-hidden="true">💡</span>
          {isOpen ? "Ocultar estrutura da frase" : "Entender estrutura da frase"}
        </span>
        <span
          className={`chunks__chevron${isOpen ? " chunks__chevron--open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="chunks__panel" id={panelId}>
          <p className="chunks__sentence">
            {card.sentence_chunks.map((chunk, position) => (
              <span className="chunks__piece" key={`${chunk.text}-${position}`}>
                {chunk.text}
              </span>
            ))}
          </p>

          <ol className="chunks__list">
            {card.sentence_chunks.map((chunk, position) => (
              <li className="chunks__item" key={`${chunk.role}-${position}`}>
                <p className="chunks__text">{chunk.text}</p>
                <p className="chunks__role">{chunk.role}</p>
                <p className="chunks__explanation">{chunk.explanation}</p>
              </li>
            ))}
          </ol>

          <p className="chunks__translation">{card.translation}</p>
        </div>
      ) : null}
    </div>
  );
}

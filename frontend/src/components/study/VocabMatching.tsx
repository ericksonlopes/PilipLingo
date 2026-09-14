import { useEffect, useMemo, useRef, useState } from "react";

import type { StudyCard, StudyExercise } from "../../lib/types";

interface VocabMatchingProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}

/**
 * Modo 4: duas colunas embaralhadas (ingles / portugues) para o aluno ligar.
 *
 * E o unico modo que consome varios cards de uma vez: o backend manda de 4 a 5 em
 * `group`. Ligar pares e reconhecimento, nao producao, entao serve de respiro
 * entre os exercicios de escrever e falar.
 *
 * O acerto so conta como "sem erro" se o aluno fechar todos os pares sem errar
 * nenhum, porque com poucas opcoes a tentativa e erro resolveria sozinha.
 */
export default function VocabMatching({ exercise, isResolved, onResolve }: VocabMatchingProps) {
  const group = exercise.group.length > 0 ? exercise.group : [exercise.card];

  // Embaralha uma vez por exercicio; sem isso cada render trocaria a ordem.
  const english = useMemo(() => shuffle(group), [group]);
  const portuguese = useMemo(() => shuffle(group), [group]);

  const [selectedEnglish, setSelectedEnglish] = useState<string | null>(null);
  const [selectedPortuguese, setSelectedPortuguese] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const hasResolved = useRef(false);

  useEffect(() => {
    if (matched.length === group.length && !hasResolved.current) {
      hasResolved.current = true;
      onResolve(mistakes === 0);
    }
  }, [group.length, matched.length, mistakes, onResolve]);

  function pick(side: "en" | "pt", cardId: string) {
    if (isResolved || matched.includes(cardId)) {
      return;
    }
    setWrongPair(null);

    const nextEnglish = side === "en" ? cardId : selectedEnglish;
    const nextPortuguese = side === "pt" ? cardId : selectedPortuguese;
    setSelectedEnglish(nextEnglish);
    setSelectedPortuguese(nextPortuguese);

    if (nextEnglish === null || nextPortuguese === null) {
      return;
    }

    if (nextEnglish === nextPortuguese) {
      setMatched((current) => [...current, nextEnglish]);
    } else {
      setMistakes((value) => value + 1);
      setWrongPair(cardId);
    }
    setSelectedEnglish(null);
    setSelectedPortuguese(null);
  }

  return (
    <div className="exercise">
      <p className="exercise__hint">
        {matched.length} de {group.length} pares
      </p>

      <div className="matching">
        <ul className="matching__column" aria-label="Frases em ingles">
          {english.map((card) => (
            <li key={`en-${card.id}`}>
              <button
                type="button"
                className={pairClass(card.id, matched, selectedEnglish, wrongPair)}
                onClick={() => pick("en", card.id)}
                disabled={isResolved || matched.includes(card.id)}
              >
                {card.sentence}
              </button>
            </li>
          ))}
        </ul>

        <ul className="matching__column" aria-label="Traducoes em portugues">
          {portuguese.map((card) => (
            <li key={`pt-${card.id}`}>
              <button
                type="button"
                className={pairClass(card.id, matched, selectedPortuguese, wrongPair)}
                onClick={() => pick("pt", card.id)}
                disabled={isResolved || matched.includes(card.id)}
              >
                {card.translation}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {isResolved ? (
        <p className={mistakes === 0 ? "feedback feedback--ok" : "feedback feedback--bad"}>
          {mistakes === 0
            ? "Todos os pares de primeira."
            : `Pares fechados com ${mistakes} ${mistakes === 1 ? "erro" : "erros"}.`}
        </p>
      ) : null}
    </div>
  );
}

function pairClass(
  cardId: string,
  matched: string[],
  selected: string | null,
  wrongPair: string | null,
): string {
  if (matched.includes(cardId)) {
    return "pair pair--matched";
  }
  if (wrongPair === cardId) {
    return "pair pair--wrong";
  }
  return selected === cardId ? "pair pair--selected" : "pair";
}

function shuffle(cards: StudyCard[]): StudyCard[] {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = copy[index] as StudyCard;
    copy[index] = copy[target] as StudyCard;
    copy[target] = current;
  }
  return copy;
}

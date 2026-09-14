import { useState } from "react";

import { useStudyHistory } from "../hooks/useStudyHistory";
import type { ProficiencyLevel, SeenWord, StudyCard } from "../lib/types";

interface HistoryPageProps {
  level: ProficiencyLevel;
}

type Tab = "sentences" | "words";

export default function HistoryPage({ level: _level }: HistoryPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("sentences");
  const { history, isLoading, error, reload } = useStudyHistory(true);

  return (
    <section className="page">
      <div className="history-tabs" role="tablist" aria-label="Tipo de historico">
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "sentences"}
          className={`history-tab${activeTab === "sentences" ? " history-tab--active" : ""}`}
          onClick={() => setActiveTab("sentences")}
        >
          Frases
          {history ? (
            <span className="history-tab__count">{history.sentences_total}</span>
          ) : null}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "words"}
          className={`history-tab${activeTab === "words" ? " history-tab--active" : ""}`}
          onClick={() => setActiveTab("words")}
        >
          Palavras
          {history ? (
            <span className="history-tab__count">{history.words_total}</span>
          ) : null}
        </button>
      </div>

      {isLoading ? (
        <p className="page__meta">Carregando historico...</p>
      ) : error ? (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={reload}>
            Tentar de novo
          </button>
        </div>
      ) : !history ||
        (activeTab === "sentences" && history.sentences.length === 0) ||
        (activeTab === "words" && history.words.length === 0) ? (
        <div className="empty">
          <p className="empty__title">Nenhum historico ainda</p>
          <p className="empty__text">
            {activeTab === "sentences"
              ? "As frases que voce estudar aparecao aqui."
              : "As palavras praticadas aparecerao aqui."}
          </p>
        </div>
      ) : activeTab === "sentences" ? (
        <SentenceList cards={history.sentences} />
      ) : (
        <WordList words={history.words} />
      )}
    </section>
  );
}

// ---------- sub-componentes ----------

function SentenceList({ cards }: { cards: StudyCard[] }) {
  return (
    <ul className="card-list" aria-label="Frases estudadas">
      {cards.map((card) => (
        <li key={card.id} className="history-card">
          <p className="history-card__sentence">{card.sentence}</p>
          <p className="history-card__translation">{card.translation}</p>
          <div className="history-card__meta">
            <span className="history-card__badge">{card.level}</span>
            <span className="history-card__theme">{card.theme}</span>
            {card.reviewed_at ? (
              <span className="history-card__date">
                {new Date(card.reviewed_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            ) : null}
            <span className="history-card__reps">
              {card.repetitions} {card.repetitions === 1 ? "revisao" : "revisoes"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function WordList({ words }: { words: SeenWord[] }) {
  return (
    <ul className="card-list" aria-label="Palavras praticadas">
      {words.map((word) => (
        <li key={word.term} className="history-card">
          <p className="history-card__sentence">{word.term}</p>
          <p className="history-card__translation">{word.translation}</p>
        </li>
      ))}
    </ul>
  );
}
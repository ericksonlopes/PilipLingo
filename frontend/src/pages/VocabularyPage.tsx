import { useState } from "react";

import AddEntrySheet from "../components/AddEntrySheet";
import VocabularyCard from "../components/VocabularyCard";
import type { useVocabulary } from "../hooks/useVocabulary";
import type { ProficiencyLevel } from "../lib/types";

interface VocabularyPageProps {
  search: string;
  onSearchChange: (value: string) => void;
  vocabulary: ReturnType<typeof useVocabulary>;
  level: ProficiencyLevel;
}

export default function VocabularyPage({
  search,
  onSearchChange,
  vocabulary,
  level,
}: VocabularyPageProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { entries, total, isLoading, error, reload, createEntry, removeEntry } = vocabulary;

  return (
    <section className="page">
      <div className="search">
        <input
          type="search"
          className="search__input"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar palavra ou traducao"
          aria-label="Buscar no vocabulario"
          enterKeyHint="search"
          autoCapitalize="none"
        />
      </div>

      <p className="page__meta">
        {isLoading ? "Carregando..." : `${total} ${total === 1 ? "palavra" : "palavras"}`}
      </p>

      {error ? (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={reload}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      {!isLoading && !error && entries.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Nada por aqui ainda</p>
          <p className="empty__text">
            {search
              ? "Nenhum resultado para essa busca."
              : "Toque em + para cadastrar sua primeira palavra."}
          </p>
        </div>
      ) : null}

      <div className="card-list">
        {entries.map((entry) => (
          <VocabularyCard key={entry.id} entry={entry} onRemove={removeEntry} />
        ))}
      </div>

      <button
        type="button"
        className="fab"
        onClick={() => setIsSheetOpen(true)}
        aria-label="Adicionar palavra"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <AddEntrySheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSubmit={createEntry}
        defaultLevel={level}
      />
    </section>
  );
}

import { useState } from "react";

import type { VocabularyEntry } from "../lib/types";

interface VocabularyCardProps {
  entry: VocabularyEntry;
  onRemove: (id: string) => Promise<void>;
}

export default function VocabularyCard({ entry, onRemove }: VocabularyCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await onRemove(entry.id);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <article className="card" aria-busy={isRemoving}>
      <div className="card__head">
        <div>
          <h2 className="card__term">{entry.term}</h2>
          <p className="card__translation">{entry.translation}</p>
        </div>
        <span className={`level level--${entry.level.toLowerCase()}`}>{entry.level}</span>
      </div>

      {entry.example ? <p className="card__example">&ldquo;{entry.example}&rdquo;</p> : null}

      {entry.tags.length > 0 ? (
        <ul className="tag-list">
          {entry.tags.map((tag) => (
            <li key={tag} className="tag">
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className="btn btn--ghost btn--sm card__remove"
        onClick={handleRemove}
        disabled={isRemoving}
      >
        {isRemoving ? "Removendo..." : "Remover"}
      </button>
    </article>
  );
}

import { useEffect, useId, useRef, useState } from "react";

import { ApiError } from "../lib/api";
import { PROFICIENCY_LEVELS } from "../lib/types";
import type { CreateVocabularyEntryInput, ProficiencyLevel } from "../lib/types";

interface AddEntrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateVocabularyEntryInput) => Promise<unknown>;
  /** Nivel informado pelo usuario: ja vem pre-selecionado no formulario. */
  defaultLevel: ProficiencyLevel;
}

/** Bottom sheet de cadastro: padrao familiar em celular e usavel com teclado. */
export default function AddEntrySheet({
  isOpen,
  onClose,
  onSubmit,
  defaultLevel,
}: AddEntrySheetProps) {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [example, setExample] = useState("");
  const [level, setLevel] = useState<ProficiencyLevel>(defaultLevel);
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  useEffect(() => {
    if (isOpen) {
      firstFieldRef.current?.focus();
      return;
    }
    setTerm("");
    setTranslation("");
    setExample("");
    setLevel(defaultLevel);
    setTags("");
    setError(null);
  }, [isOpen, defaultLevel]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        term,
        translation,
        example: example.trim() ? example : null,
        level,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Nao foi possivel salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__handle" aria-hidden="true" />
        <h2 id={`${formId}-title`} className="sheet__title">
          Nova palavra
        </h2>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Termo em ingles</span>
            <input
              ref={firstFieldRef}
              className="field__input"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="breakthrough"
              maxLength={120}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
            />
          </label>

          <label className="field">
            <span className="field__label">Traducao</span>
            <input
              className="field__input"
              value={translation}
              onChange={(event) => setTranslation(event.target.value)}
              placeholder="avanco, descoberta"
              maxLength={240}
              required
              enterKeyHint="next"
            />
          </label>

          <label className="field">
            <span className="field__label">
              Exemplo <span className="field__hint">(opcional)</span>
            </span>
            <textarea
              className="field__input field__input--area"
              value={example}
              onChange={(event) => setExample(event.target.value)}
              placeholder="The team had a major breakthrough."
              maxLength={500}
              rows={2}
            />
          </label>

          <fieldset className="field">
            <legend className="field__label">Nivel</legend>
            <div className="chip-group">
              {PROFICIENCY_LEVELS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip${level === option ? " chip--active" : ""}`}
                  aria-pressed={level === option}
                  onClick={() => setLevel(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span className="field__label">
              Tags <span className="field__hint">(separadas por virgula)</span>
            </span>
            <input
              className="field__input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="noun, work"
              enterKeyHint="done"
            />
          </label>

          {error ? (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

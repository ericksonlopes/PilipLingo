/**
 * PhraseCraftView — Interactive UI for AI Phrase Construction ("Construir Frases").
 *
 * Helps Brazilian Portuguese learners formulate native-like English sentences,
 * explore structural patterns, and understand cultural/pragmatic etiquette.
 */
import React, { useEffect, useRef } from "react";

import SpeakButton from "../../../components/translation/SpeakButton";
import type { PhraseVariation, SentencePattern } from "../../../lib/types";
import { CRAFT_MAX_CHARS, type UsePhraseCraftReturn } from "../usePhraseCraft";

interface PhraseCraftViewProps extends UsePhraseCraftReturn {}

function getFormalityClass(formality: string): string {
  const lower = formality.toLowerCase();
  if (lower.includes("educad") || lower.includes("polite") || lower.includes("formal")) {
    return "pc-pill--polite";
  }
  if (lower.includes("informal") || lower.includes("gíria") || lower.includes("casual")) {
    return "pc-pill--informal";
  }
  if (lower.includes("diret")) {
    return "pc-pill--direct";
  }
  return "pc-pill--natural";
}

function renderPatternFormula(pattern: string) {
  const parts = pattern.split(/(\[[^\]]+\])/g);
  return (
    <span className="pc-pattern-formula">
      {parts.map((part, index) => {
        if (part.startsWith("[") && part.endsWith("]")) {
          return (
            <span key={index} className="pc-pattern-slot">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

export default function PhraseCraftView({
  text,
  setText,
  result,
  loading,
  error,
  canSubmit,
  charCount,
  craftPhrase,
  clear,
  quickPrompts,
}: PhraseCraftViewProps) {
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result && !loading && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      craftPhrase();
    }
  }

  return (
    <div className="phrase-craft-view">
      {/* Input area */}
      <div className="translate-input-area pc-input-card">
        <label htmlFor="craft-input" className="field__label pc-input-label">
          O que você quer dizer em inglês?
        </label>
        <p className="pc-input-hint">
          Digite sua ideia ou intenção em português (ou rascunho em inglês) e a IA indicará as formas autênticas que nativos usam.
        </p>

        {/* Quick prompt suggestions */}
        <div className="pc-quick-chips" aria-label="Sugestões de frases">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="pc-chip"
              disabled={loading}
              onClick={() => craftPhrase(prompt)}
            >
              <span className="pc-chip__sparkle" aria-hidden="true">✦</span>
              {prompt}
            </button>
          ))}
        </div>

        <textarea
          id="craft-input"
          className="translate-textarea pc-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ex.: "eu quero pizza", "pedir a conta", "falar que estou com pressa"...'
          maxLength={CRAFT_MAX_CHARS + 1}
          disabled={loading}
          aria-describedby="craft-char-count"
          rows={3}
        />

        <div className="translate-input-area__footer">
          <p
            id="craft-char-count"
            className={`translate-char-count${
              charCount > CRAFT_MAX_CHARS * 0.9 ? " translate-char-count--warn" : ""
            }`}
          >
            {charCount}/{CRAFT_MAX_CHARS} · <kbd>Ctrl+Enter</kbd> para construir
          </p>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn--primary pc-submit-btn"
              onClick={() => craftPhrase()}
              disabled={!canSubmit}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="pc-spinner" aria-hidden="true" />
                  Construindo…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="pc-btn-icon">
                    <path
                      d="M12 2l2.4 7.2h7.6l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3-6.2-4.5h7.6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Construir Frases
                </>
              )}
            </button>

            {(result || error || text.trim()) && !loading && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={clear}
                aria-label="Limpar campo e resultados"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* States: Error, Loading skeleton, Results */}
      {(error || loading || result) && (
        <div ref={resultsRef} className="pc-results-scroll">
          {error && (
            <div role="alert" className="alert alert--error">
              {error}
            </div>
          )}

          {loading && (
            <div className="setup-skeleton pc-skeleton" aria-busy="true" aria-label="Construindo frases…">
              <div className="skeleton-row skeleton-row--wide" style={{ height: "70px" }} />
              <div className="skeleton-row skeleton-row--wide" style={{ height: "130px", animationDelay: "0.1s" }} />
              <div className="skeleton-row skeleton-row--wide" style={{ height: "130px", animationDelay: "0.2s" }} />
              <div className="skeleton-row skeleton-row--medium" style={{ height: "100px", animationDelay: "0.3s" }} />
            </div>
          )}

          {result && !loading && (
            <div className="pc-content">
              {/* Intent header */}
              <div className="pc-intent-header">
                <span className="pc-intent-badge">
                  🎯 {result.intent_summary}
                </span>
                <span className="pc-intent-original">
                  Ideia original: <em>&ldquo;{result.original}&rdquo;</em>
                </span>
              </div>

              {/* Cultural & Pragmatic Tip Banner */}
              {result.cultural_tip && (
                <div className="pc-tip-card">
                  <div className="pc-tip-card__header">
                    <span className="pc-tip-card__icon" aria-hidden="true">💡</span>
                    <h3 className="pc-tip-card__title">Dica Pragmática &amp; Cultural</h3>
                  </div>
                  <p className="pc-tip-card__body">{result.cultural_tip}</p>
                </div>
              )}

              {/* Variations Section */}
              <section className="pc-section" aria-label="Maneiras de expressar em inglês">
                <div className="pc-section__header">
                  <h2 className="pc-section__title">Maneiras de dizer em inglês</h2>
                  <p className="pc-section__subtitle">
                    Escolha a formulação ideal para o seu contexto e tom de conversa.
                  </p>
                </div>

                <div className="pc-variations-grid">
                  {result.variations.map((v: PhraseVariation, index: number) => (
                    <article key={index} className="pc-variation-card">
                      <div className="pc-variation-card__top">
                        <div className="pc-variation-card__meta">
                          <span className="pc-context-tag">
                            {v.context}
                          </span>
                          <span className={`pc-pill ${getFormalityClass(v.formality)}`}>
                            {v.formality}
                          </span>
                        </div>
                        <SpeakButton
                          text={v.english_phrase}
                          lang="en-US"
                          label="Ouvir frase"
                          className="speak-btn speak-btn--sm"
                        />
                      </div>

                      <p className="pc-variation-card__phrase">{v.english_phrase}</p>
                      <p className="pc-variation-card__translation">{v.portuguese_translation}</p>

                      {v.explanation && (
                        <div className="pc-variation-card__explanation">
                          <span className="pc-explanation-bullet" aria-hidden="true">👉</span>
                          <span>{v.explanation}</span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              {/* Sentence Patterns Section */}
              {result.patterns && result.patterns.length > 0 && (
                <section className="pc-section pc-section--patterns" aria-label="Fórmulas e Padrões Reutilizáveis">
                  <div className="pc-section__header">
                    <h2 className="pc-section__title">Fórmulas e Padrões Reutilizáveis</h2>
                    <p className="pc-section__subtitle">
                      Modelos gramaticais para você memorizar e reutilizar criando novas frases.
                    </p>
                  </div>

                  <div className="pc-patterns-list">
                    {result.patterns.map((p: SentencePattern, index: number) => (
                      <div key={index} className="pc-pattern-card">
                        <div className="pc-pattern-card__header">
                          <div className="pc-pattern-card__formula">
                            {renderPatternFormula(p.pattern)}
                          </div>
                        </div>

                        <p className="pc-pattern-card__explanation">{p.explanation}</p>

                        {p.examples && p.examples.length > 0 && (
                          <div className="pc-pattern-card__examples">
                            <span className="pc-pattern-card__examples-title">Exemplos práticos:</span>
                            <ul className="pc-pattern-card__examples-list">
                              {p.examples.map((example: string, exIdx: number) => (
                                <li key={exIdx} className="pc-pattern-card__example-item">
                                  <span className="pc-pattern-example-bullet">•</span>
                                  <span className="pc-pattern-example-text">{example}</span>
                                  <SpeakButton
                                    text={example}
                                    lang="en-US"
                                    className="speak-btn speak-btn--inline"
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

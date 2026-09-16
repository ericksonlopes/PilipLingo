/**
 * Página /traduzir — Tradução Avançada com três modos:
 *  - "Traduzir": campo único, resultado completo com blocos gramaticais
 *  - "Construir Frases": assistência de IA para formular frases naturais, padrões e dicas pragmáticas
 *  - "Chat": interface conversacional, cada mensagem gera um turno
 */
import { useEffect, useRef, useState } from "react";

import TranslationBreakdown from "../components/translation/TranslationBreakdown";
import PhraseCraftView from "../features/translation/components/PhraseCraftView";
import TranslateChatView from "../features/translation/components/TranslateChatView";
import { usePhraseCraft } from "../features/translation/usePhraseCraft";
import { useTranslateChat } from "../features/translation/useTranslateChat";
import { ApiError, translationApi } from "../lib/api";
import type { TranslationResult } from "../lib/types";

type TabId = "single" | "craft" | "chat";

const MAX_CHARS = 1000;

export default function TranslatePage() {
  const [tab, setTab] = useState<TabId>("single");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  return (
    <div className={`page translate-page${tab === "chat" ? " translate-page--chat" : ""}`}>
      {/* Cabeçalho e seletor de modo fixos no topo */}
      <div className="translate-page__sticky-top">
        <div className="translate-page__head">
          <h1 className="translate-page__title">Tradução e Construção</h1>
          <p className="translate-page__subtitle">
            {tab === "craft"
              ? "Descubra como nativos expressam sua ideia em diferentes contextos."
              : tab === "chat"
              ? "Conversação guiada e tradução contextual contínua."
              : "Inglês ↔ Português com análise de blocos gramaticais."}
          </p>
        </div>

        {/* Seletor de modo */}
        <div className="translate-tabs" role="tablist" aria-label="Modo de tradução">
          <button
            role="tab"
            type="button"
            aria-selected={tab === "single"}
            className={`translate-tab${tab === "single" ? " translate-tab--active" : ""}`}
            onClick={() => setTab("single")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M3 5h12M9 3v2M7 19l4-8 4 8M8.5 16h5M14 5l7 7-2 2M17 12l-3 3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            Traduzir
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={tab === "craft"}
            className={`translate-tab${tab === "craft" ? " translate-tab--active" : ""}`}
            onClick={() => setTab("craft")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 2l2.4 7.2h7.6l-6.2 4.5 2.4 7.3-6.2-4.5-6.2 4.5 2.4-7.3-6.2-4.5h7.6z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            Construir Frases
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={tab === "chat"}
            className={`translate-tab${tab === "chat" ? " translate-tab--active" : ""}`}
            onClick={() => setTab("chat")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            Chat
          </button>
        </div>
      </div>

      {tab === "single" && <SingleMode />}
      {tab === "craft"  && <CraftMode />}
      {tab === "chat"   && <ChatMode />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Modo Traduzir — campo único, resultado completo
──────────────────────────────────────────────────────────── */
function SingleMode() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = text.trim();
  const charCount = text.length;
  const canSubmit = trimmed.length > 0 && charCount <= MAX_CHARS && !loading;

  async function handleTranslate() {
    if (!canSubmit) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await translationApi.translate({ text: trimmed }, ctrl.signal);
      setResult(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof ApiError) {
        setError(
          err.status === 503
            ? "Serviço de IA indisponível no momento. Tente novamente em breve."
            : err.message,
        );
      } else {
        setError("Erro inesperado. Verifique sua conexão e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleTranslate();
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    setText("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="translate-single-mode">
      <div className="translate-input-area">
        <label htmlFor="translate-input" className="field__label">
          Frase em inglês ou português
        </label>

        <textarea
          id="translate-input"
          className="translate-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite ou cole uma frase em inglês ou português..."
          maxLength={MAX_CHARS + 1}
          disabled={loading}
          aria-describedby="translate-char-count"
          rows={3}
        />

        <div className="translate-input-area__footer">
          <p
            id="translate-char-count"
            className={`translate-char-count${charCount > MAX_CHARS * 0.9 ? " translate-char-count--warn" : ""}`}
          >
            {charCount}/{MAX_CHARS} · <kbd>Ctrl+Enter</kbd> para traduzir
          </p>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleTranslate}
              disabled={!canSubmit}
              aria-busy={loading}
            >
              {loading ? "Traduzindo…" : "Traduzir"}
            </button>

            {(result || error || trimmed) && !loading && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleClear}
                aria-label="Limpar"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {(error || loading || result) && (
        <div className="translate-result-scroll">
          {error && (
            <div role="alert" className="alert alert--error">
              {error}
            </div>
          )}

          {loading && (
            <div className="setup-skeleton" aria-busy="true" aria-label="Traduzindo…">
              <div className="skeleton-row skeleton-row--wide" style={{ height: "80px" }} />
              <div className="skeleton-row skeleton-row--wide" style={{ height: "140px", animationDelay: "0.1s" }} />
              <div className="skeleton-row skeleton-row--medium" style={{ animationDelay: "0.2s" }} />
            </div>
          )}

          {result && !loading && <TranslationBreakdown result={result} />}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Modo Construir Frases — exploração contextual e padrões
──────────────────────────────────────────────────────────── */
function CraftMode() {
  const craft = usePhraseCraft();
  return <PhraseCraftView {...craft} />;
}

/* ────────────────────────────────────────────────────────────
   Modo Chat — conversacional, um turno por mensagem
──────────────────────────────────────────────────────────── */
function ChatMode() {
  const chat = useTranslateChat();
  return <TranslateChatView {...chat} />;
}

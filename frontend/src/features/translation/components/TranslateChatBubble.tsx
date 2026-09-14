/**
 * TranslateChatBubble — um turno do chat de tradução.
 *
 * Estrutura:
 *  - Bolha do usuário (texto enviado)
 *  - Bolha de resposta com:
 *      · par EN ↔ PT compacto com botões de áudio
 *      · accordion "Ver análise" que expande o TranslationBreakdown completo
 *  - Estado de carregamento (typing indicator) e erro
 */
import { useState } from "react";

import TranslationBreakdown from "../../../components/translation/TranslationBreakdown";
import SpeakButton from "../../../components/translation/SpeakButton";
import CorrectionBanner from "../../../components/translation/CorrectionBanner";
import type { TranslateTurn } from "../useTranslateChat";

interface TranslateChatBubbleProps {
  turn: TranslateTurn;
}

export default function TranslateChatBubble({ turn }: TranslateChatBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tc-turn">
      {/* ── Bolha do usuário ── */}
      <div className="chat-bubble chat-bubble--user">
        <p className="chat-bubble__text">{turn.userText}</p>
      </div>

      {/* ── Carregando ── */}
      {turn.pending && (
        <div className="tc-bubble-ai tc-bubble-ai--loading" aria-busy="true" aria-label="Traduzindo…">
          <div className="typing-indicator">
            <span className="typing-indicator__dot" />
            <span className="typing-indicator__dot" />
            <span className="typing-indicator__dot" />
          </div>
        </div>
      )}

      {/* ── Erro ── */}
      {turn.error && !turn.pending && (
        <div className="tc-bubble-ai tc-bubble-ai--error" role="alert">
          <p className="tc-bubble-ai__error-text">{turn.error}</p>
        </div>
      )}

      {/* ── Resultado ── */}
      {turn.result && !turn.pending && (
        <div className="tc-bubble-ai">
          {/* Correções gramaticais — só aparece se há erros */}
          <CorrectionBanner
            corrections={turn.result.corrections}
            correctedPhrase={turn.result.english_phrase}
          />

          {/* Par compacto EN com botão de áudio */}
          <div className="tc-pair-compact">
            <span className="tc-pair-compact__lang">🇺🇸</span>
            <p className="tc-pair-compact__en">{turn.result.english_phrase}</p>
            <SpeakButton
              text={turn.result.english_phrase}
              lang="en-US"
              className="speak-btn speak-btn--inline"
            />
          </div>

          {/* Par compacto PT com botão de áudio */}
          <div className="tc-pair-compact tc-pair-compact--pt">
            <span className="tc-pair-compact__lang">🇧🇷</span>
            <p className="tc-pair-compact__pt">{turn.result.portuguese_phrase}</p>
            <SpeakButton
              text={turn.result.portuguese_phrase}
              lang="pt-BR"
              className="speak-btn speak-btn--inline"
            />
          </div>

          {/* Accordion de análise detalhada */}
          {(turn.result.chunks.length > 0 || turn.result.assembly_summary) && (
            <div className="tc-accordion">
              <button
                type="button"
                className="tc-accordion__toggle"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                  className={`tc-accordion__chevron${expanded ? " tc-accordion__chevron--open" : ""}`}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                {expanded ? "Fechar análise" : "Ver análise de blocos"}
              </button>

              {expanded && (
                <div className="tc-accordion__panel">
                  <TranslationBreakdown result={turn.result} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

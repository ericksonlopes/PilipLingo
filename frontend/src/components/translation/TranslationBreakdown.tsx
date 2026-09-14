/**
 * TranslationBreakdown — exibe o resultado de uma tradução avançada.
 *
 * Funciona nos dois sentidos (EN→PT e PT→EN).
 * A análise de blocos é SEMPRE sobre a frase em inglês.
 *
 * Seções:
 *  1. Par EN ↔ PT com botões de áudio individuais
 *  2. Blocos gramaticais do inglês (texto, papel, explicação)
 *  3. Resumo de como a frase em inglês foi montada
 */
import SpeakButton from "./SpeakButton";
import CorrectionBanner from "./CorrectionBanner";
import type { TranslationResult } from "../../lib/types";

interface TranslationBreakdownProps {
  result: TranslationResult;
}

export default function TranslationBreakdown({ result }: TranslationBreakdownProps) {
  const hasChunks = result.chunks.length > 0;

  return (
    <div className="translation-breakdown">

      {/* ── 0. Correções gramaticais (só aparece quando há erros) ── */}
      <CorrectionBanner
        corrections={result.corrections}
        correctedPhrase={result.english_phrase}
      />

      {/* ── 1. Par EN ↔ PT ── */}
      <section className="tb-section tb-section--main" aria-label="Par de traduções">
        <div className="tb-pair">
          <div className="tb-pair__side">
            <div className="tb-pair__side-header">
              <span className="tb-pair__lang">🇺🇸 Inglês</span>
              <SpeakButton
                text={result.english_phrase}
                lang="en-US"
                label="inglês"
                className="speak-btn speak-btn--sm"
              />
            </div>
            <p className="tb-original">{result.english_phrase}</p>
          </div>
          <div className="tb-pair__divider" aria-hidden="true" />
          <div className="tb-pair__side">
            <div className="tb-pair__side-header">
              <span className="tb-pair__lang">🇧🇷 Português</span>
              <SpeakButton
                text={result.portuguese_phrase}
                lang="pt-BR"
                label="português"
                className="speak-btn speak-btn--sm"
              />
            </div>
            <p className="tb-translation">{result.portuguese_phrase}</p>
          </div>
        </div>
      </section>

      {/* ── 2. Análise de blocos (sempre sobre o inglês) ── */}
      {hasChunks && (
        <section className="tb-section" aria-label="Análise de blocos">
          <h2 className="tb-section__title">
            <span className="tb-section__icon" aria-hidden="true">🔬</span>
            Análise de blocos — inglês
          </h2>

          {/* Visualização inline dos blocos coloridos */}
          <p className="tb-chunks-inline" aria-label="Blocos da frase em inglês">
            {result.chunks.map((chunk, i) => (
              <span key={i} className={`tb-chunk-token tb-chunk-token--${(i % 5) + 1}`}>
                {chunk.text}
              </span>
            ))}
          </p>

          {/* Lista detalhada */}
          <ol className="tb-chunk-list" aria-label="Detalhes de cada bloco">
            {result.chunks.map((chunk, i) => (
              <li
                key={i}
                className={`tb-chunk-item tb-chunk-item--${(i % 5) + 1}`}
              >
                <p className="tb-chunk-item__text">{chunk.text}</p>
                <p className="tb-chunk-item__role">{chunk.role}</p>
                <p className="tb-chunk-item__explanation">{chunk.explanation}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── 3. Resumo de montagem ── */}
      {result.assembly_summary && (
        <section className="tb-section" aria-label="Como a frase foi montada">
          <h2 className="tb-section__title">
            <span className="tb-section__icon" aria-hidden="true">🧩</span>
            Como a frase foi montada
          </h2>
          <p className="tb-assembly-summary">{result.assembly_summary}</p>
        </section>
      )}

    </div>
  );
}

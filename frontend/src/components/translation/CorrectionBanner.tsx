/**
 * CorrectionBanner — exibe correções gramaticais/ortográficas de inglês.
 *
 * Aparece quando o usuário escreveu em inglês com erros.
 * Mostra: frase corrigida em destaque + lista de cada erro com explicação.
 */
import type { GrammarCorrection } from "../../lib/types";

interface CorrectionBannerProps {
  corrections: GrammarCorrection[];
  /** Frase corrigida completa (english_phrase do resultado). */
  correctedPhrase: string;
}

export default function CorrectionBanner({
  corrections,
  correctedPhrase,
}: CorrectionBannerProps) {
  if (corrections.length === 0) return null;

  return (
    <div className="correction-banner" role="region" aria-label="Correções gramaticais">
      {/* Cabeçalho */}
      <div className="correction-banner__header">
        <span className="correction-banner__icon" aria-hidden="true">✏️</span>
        <span className="correction-banner__title">
          {corrections.length === 1 ? "1 correção encontrada" : `${corrections.length} correções encontradas`}
        </span>
      </div>

      {/* Frase corrigida completa */}
      <p className="correction-banner__phrase">
        <span className="correction-banner__phrase-label">Corrigido: </span>
        {correctedPhrase}
      </p>

      {/* Lista de erros individuais */}
      <ul className="correction-list" aria-label="Detalhes das correções">
        {corrections.map((c, i) => (
          <li key={i} className="correction-item">
            <div className="correction-item__diff">
              {/* Versão errada riscada */}
              <span className="correction-item__wrong" aria-label={`Errado: ${c.original}`}>
                {c.original}
              </span>
              <span className="correction-item__arrow" aria-hidden="true">→</span>
              {/* Versão correta */}
              <span className="correction-item__right" aria-label={`Correto: ${c.corrected}`}>
                {c.corrected}
              </span>
            </div>
            <p className="correction-item__explanation">{c.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Comparacao das respostas do aluno.
 *
 * Vive no frontend porque a correcao dos cinco modos acontece no aparelho. A
 * regra e ser exigente com a palavra e tolerante com o resto: pontuacao,
 * maiuscula e espaco duplo nao sao o que esta sendo ensinado.
 */

// ─── Normalizacao ─────────────────────────────────────────────────────────────

/** Pontuacao de borda e removida; o apostrofo interno de "I've" e preservado. */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFC")
    .replace(/[']/g, "'")
    .split(/\s+/)
    .map((token) => token.replace(EDGE_PUNCTUATION, ""))
    .filter((token) => token.length > 0)
    .join(" ");
}

export function isExactAnswer(given: string, expected: string): boolean {
  return normalizeAnswer(given) === normalizeAnswer(expected);
}

// ─── Levenshtein por caractere ────────────────────────────────────────────────

/**
 * Distancia de Levenshtein entre dois tokens (ja normalizados).
 * Custo de substituicao = 1, insercao/delecao = 1.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const sub = (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      curr.push(Math.min(sub, (prev[j] as number) + 1, (curr[j - 1] as number) + 1));
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length] as number;
}

/**
 * Limiar de distancia para considerar "quase certo" em funcao do comprimento
 * da palavra esperada.
 *
 *  1–3 chars  → sem tolerancia (palavras curtas, 1 erro muda tudo)
 *  4–6 chars  → tolerancia 1
 *  7+ chars   → tolerancia 2
 */
function closenessThreshold(expectedLength: number): number {
  if (expectedLength <= 3) return 0;
  if (expectedLength <= 6) return 1;
  return 2;
}

/**
 * Retorna true quando a resposta digitada e "quase certa": nao e exata, mas
 * esta dentro do limiar de distancia para o comprimento da palavra esperada.
 */
export function isCloseAnswer(given: string, expected: string): boolean {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (g === e) return false; // exata — nao e "quase"
  const threshold = closenessThreshold(e.length);
  if (threshold === 0) return false;
  return levenshtein(g, e) <= threshold;
}

// ─── Deteccao de erros ortograficos em frases livres ─────────────────────────

/**
 * Para o modo "Criar frase" o aluno escreve em ingles. O servico de backend
 * valida a estrutura gramatical, mas erros tipograficos simples nao sao
 * detectados pelo spaCy. Esta funcao compara cada token digitado com a lista
 * de palavras do card (sentence + focus_term) e sinaliza os que parecem ser
 * erro de digitacao (distancia = 1 em relacao a uma palavra conhecida do
 * exercicio).
 *
 * Retorna um array de { original, suggestion } para as palavras suspeitas.
 * Palavras muito curtas (<= 2 chars) sao ignoradas para evitar falsos positivos.
 */
export interface SpellingSuggestion {
  original: string;
  suggestion: string;
}

export function detectTypos(
  typed: string,
  referenceWords: string[],
): SpellingSuggestion[] {
  const refNorm = referenceWords.map((w) => normalizeAnswer(w)).filter((w) => w.length > 2);
  const tokens = typed
    .split(/\s+/)
    .map((t) => t.replace(EDGE_PUNCTUATION, ""))
    .filter((t) => t.length > 2);

  const seen = new Set<string>();
  const suggestions: SpellingSuggestion[] = [];

  for (const token of tokens) {
    const norm = token.toLowerCase().normalize("NFC");
    if (seen.has(norm)) continue;
    seen.add(norm);

    // Ignora se e exatamente igual a alguma referencia
    if (refNorm.includes(norm)) continue;

    // Procura a referencia mais proxima com distancia = 1
    for (const ref of refNorm) {
      if (Math.abs(ref.length - norm.length) > 2) continue; // otimizacao de custo
      if (levenshtein(norm, ref) === 1) {
        suggestions.push({ original: token, suggestion: ref });
        break;
      }
    }
  }

  return suggestions;
}

// ─── Similaridade por palavra (LCS) ──────────────────────────────────────────

/**
 * Similaridade por palavra, de 0 a 1, usando a maior subsequencia comum.
 *
 * Usada na pratica de fala: o reconhecimento do navegador troca "to" por "two" e
 * come artigos, entao exigir transcricao exata reprovaria o aluno por erro do
 * microfone, nao por erro de ingles.
 */
export function answerSimilarity(given: string, expected: string): number {
  const givenWords = normalizeAnswer(given).split(" ").filter(Boolean);
  const expectedWords = normalizeAnswer(expected).split(" ").filter(Boolean);

  if (expectedWords.length === 0) {
    return givenWords.length === 0 ? 1 : 0;
  }
  if (givenWords.length === 0) {
    return 0;
  }

  const common = longestCommonSubsequence(givenWords, expectedWords);
  return common / Math.max(givenWords.length, expectedWords.length);
}

/** Aceita a fala quando bate o suficiente com a frase esperada. */
export const SPEAKING_PASS_RATIO = 0.75;

export function isSpokenAnswerAccepted(transcripts: string[], expected: string): boolean {
  return transcripts.some(
    (transcript) =>
      isExactAnswer(transcript, expected) ||
      answerSimilarity(transcript, expected) >= SPEAKING_PASS_RATIO,
  );
}

export function bestSimilarity(transcripts: string[], expected: string): number {
  return transcripts.reduce(
    (best, transcript) => Math.max(best, answerSimilarity(transcript, expected)),
    0,
  );
}

function longestCommonSubsequence(left: string[], right: string[]): number {
  // Matriz (n+1) x (m+1) classica; as frases sao curtas, custo irrelevante.
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const previous = table[i - 1] as number[];
      const current = table[i] as number[];
      current[j] =
        left[i - 1] === right[j - 1]
          ? (previous[j - 1] as number) + 1
          : Math.max(previous[j] as number, current[j - 1] as number);
    }
  }

  return (table[left.length] as number[])[right.length] as number;
}

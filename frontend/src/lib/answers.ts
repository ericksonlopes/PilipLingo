/**
 * Comparacao das respostas do aluno.
 *
 * Vive no frontend porque a correcao dos cinco modos acontece no aparelho. A
 * regra e ser exigente com a palavra e tolerante com o resto: pontuacao,
 * maiuscula e espaco duplo nao sao o que esta sendo ensinado.
 */

/** Pontuacao de borda e removida; o apostrofo interno de "I've" e preservado. */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFC")
    .replace(/[’]/g, "'")
    .split(/\s+/)
    .map((token) => token.replace(EDGE_PUNCTUATION, ""))
    .filter((token) => token.length > 0)
    .join(" ");
}

export function isExactAnswer(given: string, expected: string): boolean {
  return normalizeAnswer(given) === normalizeAnswer(expected);
}

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

/**
 * Student answer evaluation.
 *
 * Runs on frontend since checking for all five modes happens on device.
 * Tolerates minor punctuation, capitalization, and spacing differences.
 */

// ─── Normalization ────────────────────────────────────────────────────────

/** Edge punctuation is stripped; internal apostrophe in "I've" is preserved. */
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

// ─── Character-level Levenshtein ──────────────────────────────────────────

/**
 * Levenshtein distance between two normalized tokens.
 * Substitution cost = 1, insertion/deletion = 1.
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
 * Distance threshold for considering an answer "almost right" based on
 * expected word length.
 *
 *  1–3 chars  → no tolerance
 *  4–6 chars  → tolerance 1
 *  7+ chars   → tolerance 2
 */
function closenessThreshold(expectedLength: number): number {
  if (expectedLength <= 3) return 0;
  if (expectedLength <= 6) return 1;
  return 2;
}

/**
 * Returns true when typed answer is "almost right": not exact, but within
 * distance threshold for expected word length.
 */
export function isCloseAnswer(given: string, expected: string): boolean {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (g === e) return false;
  const threshold = closenessThreshold(e.length);
  if (threshold === 0) return false;
  return levenshtein(g, e) <= threshold;
}

// ─── Typo detection in free-form sentences ────────────────────────────────

/**
 * For "Sentence Builder" mode the student writes in English. Backend service
 * validates grammatical structure. This function compares typed tokens with card
 * words to highlight potential typos.
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

    if (refNorm.includes(norm)) continue;

    for (const ref of refNorm) {
      if (Math.abs(ref.length - norm.length) > 2) continue;
      if (levenshtein(norm, ref) === 1) {
        suggestions.push({ original: token, suggestion: ref });
        break;
      }
    }
  }

  return suggestions;
}

// ─── Word similarity (LCS) ────────────────────────────────────────────────

/**
 * Word-level similarity (0 to 1) using Longest Common Subsequence.
 * Used for speaking practice.
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

/** Accepts speech input when similarity ratio reaches threshold. */
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

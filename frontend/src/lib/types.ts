export const PROFICIENCY_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export interface VocabularyEntry {
  id: string;
  term: string;
  translation: string;
  example: string | null;
  level: ProficiencyLevel;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface VocabularyPage {
  items: VocabularyEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateVocabularyEntryInput {
  term: string;
  translation: string;
  example?: string | null;
  level?: ProficiencyLevel;
  tags?: string[];
}

export interface UpdateVocabularyEntryInput {
  translation?: string;
  example?: string | null;
  level?: ProficiencyLevel;
  tags?: string[];
}

/** Formato de erro devolvido pelo backend (shared/api/error_handlers.py). */
export interface ApiErrorBody {
  error?: { code?: string; message?: string };
  detail?: unknown;
}

/* ---------- autenticacao ---------- */

export interface AuthUser {
  id: string;
  username: string;
  created_at: string;
}

/** Resposta de /auth/register e /auth/login. */
export interface AuthResult {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

/** Um bloco logico da frase: a unidade da Analise Estrutural. */
export interface SentenceChunk {
  text: string;
  role: string;
  explanation: string;
}

export interface GeneratedSentence {
  text: string;
  translation: string;
  level: ProficiencyLevel;
  focus_term: string | null;
  chunks: SentenceChunk[];
}

export interface GenerateSentencesInput {
  level: ProficiencyLevel;
  count?: number;
  terms?: string[];
  topic?: string | null;
  use_my_vocabulary?: boolean;
}

export interface GeneratedSentencesResult {
  level: ProficiencyLevel;
  items: GeneratedSentence[];
  terms_used: string[];
}

export interface AiStatus {
  enabled: boolean;
  model: string | null;
  max_sentences_per_request: number;
}

/* ---------- estudo ---------- */

export const EXERCISE_MODES = [
  "TYPING_CLOZE",
  "AUDIO_DICTATION",
  "BLOCK_TRANSLATION",
  "VOCAB_MATCHING",
  "SPEAKING_PRACTICE",
  "SENTENCE_BUILDER",
] as const;

export type ExerciseMode = (typeof EXERCISE_MODES)[number];

export interface StudyModeOption {
  mode: ExerciseMode;
  label: string;
}

export interface StudyThemeOption {
  theme: string | null;
  label: string;
}

export interface StudyOptions {
  modes: StudyModeOption[];
  themes: StudyThemeOption[];
}

export const REVIEW_GRADES = ["AGAIN", "HARD", "GOOD", "EASY"] as const;

export type ReviewGrade = (typeof REVIEW_GRADES)[number];

export interface StudyCard {
  id: string;
  sentence: string;
  translation: string;
  focus_term: string;
  focus_term_translation: string | null;
  level: ProficiencyLevel;
  theme: string;
  sentence_chunks: SentenceChunk[];
  repetitions: number;
  lapses: number;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  reviewed_at: string | null;
  is_new: boolean;
}

/**
 * Um card ja sorteado para um dos cinco modos. `answer` vem do backend porque a
 * correcao acontece aqui no aparelho (digitacao, ordem dos blocos e Speech
 * Recognition do navegador).
 */
export interface StudyExercise {
  mode: ExerciseMode;
  instruction: string;
  needs_audio: boolean;
  prompt: string;
  answer: string;
  blocks: string[];
  card: StudyCard;
  group: StudyCard[];
}

export interface StudySession {
  level: ProficiencyLevel;
  total: number;
  generated_count: number;
  due_count: number;
  ahead_count: number;
  themes: string[];
  exercises: StudyExercise[];
}

export interface ReviewResult {
  card: StudyCard;
  next_due_at: string;
  interval_days: number;
}

// ---------- historico ----------

export interface SeenWord {
  term: string;
  translation: string;
}

export interface StudyHistoryPage {
  sentences: StudyCard[];
  sentences_total: number;
  words: SeenWord[];
  words_total: number;
  limit: number;
  offset: number;
}

// ---------- sentence builder ----------

export interface SentenceValidationResponse {
  valid: boolean;
  reason: "missing_term" | "no_subject_verb" | "agreement_error" | null;
  feedback: string | null;
}

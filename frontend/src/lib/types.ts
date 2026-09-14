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

/** Um item de vocabulario da frase (palavra/expressao + traducao). */
export interface SentenceVocabulary {
  term: string;
  translation: string;
}

export interface GeneratedSentence {
  text: string;
  translation: string;
  level: ProficiencyLevel;
  focus_term: string | null;
  chunks: SentenceChunk[];
  vocabulary: SentenceVocabulary[];
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
  vocabulary: SentenceVocabulary[];
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

// ---------- chat ----------

export const CONVERSATION_MODES = ["FREE", "TOPIC", "GOAL"] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export const CONVERSATION_STATUSES = ["active", "completed", "abandoned"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const GOAL_STATUSES = ["in_progress", "achieved", "abandoned"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface ChatTopic {
  id: string;
  label: string;
  description: string;
  level_hint: ProficiencyLevel;
}

export interface ChatGoal {
  id: string;
  label: string;
  description: string;
  level_hint: ProficiencyLevel;
  targets: string[];
}

export interface ChatStatus {
  enabled: boolean;
  model: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  mode: ConversationMode;
  level: ProficiencyLevel;
  topic: string | null;
  goal: string | null;
  goals: string[];
  goals_progress: boolean[];
  goal_status: GoalStatus;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
}

export interface ConversationPage {
  items: Conversation[];
  total: number;
  limit: number;
  offset: number;
}

export interface FeedbackCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface TurnFeedback {
  corrections: FeedbackCorrection[];
  suggestion: string | null;
}

export interface ConversationTurn {
  id: string;
  conversation_id: string;
  turn_index: number;
  user_message: string;
  ai_reply: string;
  feedback: TurnFeedback | null;
  created_at: string;
}

export interface SendTurnResult {
  turn: ConversationTurn;
  conversation_completed: boolean;
  goal_achieved: boolean;
  goals_progress?: boolean[];
}

export interface CreateConversationInput {
  mode: ConversationMode;
  level: ProficiencyLevel;
  topic?: string | null;
  goal?: string | null;
  goals?: string[] | null;
}

// ---------- tradução avançada ----------

export interface TranslationChunk {
  text: string;
  /** Papel gramatical em inglês, ex.: "Present Perfect", "Subject". */
  role: string;
  /** Explicação do bloco em português. */
  explanation: string;
}

export interface GrammarCorrection {
  /** Fragmento exatamente como o usuário escreveu (errado). */
  original: string;
  /** Forma correta. */
  corrected: string;
  /** Explicação em português de por que está errado. */
  explanation: string;
}

export interface TranslationResult {
  original: string;
  translation: string;
  /** A frase sempre em inglês (base dos chunks), independente da direção. */
  english_phrase: string;
  /** A frase sempre em português. */
  portuguese_phrase: string;
  /** Correções gramaticais/ortográficas — lista vazia se a entrada estava correta ou era PT. */
  corrections: GrammarCorrection[];
  chunks: TranslationChunk[];
  /** 1–3 frases em português explicando como os blocos formam o sentido. */
  assembly_summary: string;
}

export interface TranslateInput {
  text: string;
}

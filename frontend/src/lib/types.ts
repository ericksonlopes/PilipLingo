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

/** Error payload returned by backend (shared/api/error_handlers.py). */
export interface ApiErrorBody {
  error?: { code?: string; message?: string };
  detail?: unknown;
}

/* ---------- authentication ---------- */

export interface AuthUser {
  id: string;
  username: string;
  created_at: string;
}

/** Response from /auth/register and /auth/login. */
export interface AuthResult {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

/** Logical sentence block: unit of Structural Analysis. */
export interface SentenceChunk {
  text: string;
  role: string;
  explanation: string;
}

/** Vocabulary item from sentence (word/phrase + translation). */
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

/* ---------- study ---------- */

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
 * A card prepared for one of the exercise modes. `answer` comes from backend
 * because grading happens on device (typing, block order, Speech Recognition).
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

// ---------- history ----------

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

// ---------- advanced translation ----------

export interface TranslationChunk {
  text: string;
  /** Grammatical role in English, e.g., "Present Perfect", "Subject". */
  role: string;
  /** Block explanation in Portuguese. */
  explanation: string;
}

export interface GrammarCorrection {
  /** Exact fragment written by user (erroneous). */
  original: string;
  /** Correct form. */
  corrected: string;
  /** Explanation in Portuguese of why it is wrong. */
  explanation: string;
}

export interface TranslationResult {
  original: string;
  translation: string;
  /** Phrase always in English (base of chunks), regardless of direction. */
  english_phrase: string;
  /** Phrase always in Portuguese. */
  portuguese_phrase: string;
  /** Grammar/spelling corrections — empty list if input was correct or PT. */
  corrections: GrammarCorrection[];
  chunks: TranslationChunk[];
  /** 1–3 sentences in Portuguese explaining how blocks combine meaning. */
  assembly_summary: string;
}

export interface TranslateInput {
  text: string;
}

// ---------- phrase crafting ----------

export interface PhraseVariation {
  english_phrase: string;
  portuguese_translation: string;
  context: string;
  formality: string;
  explanation: string;
}

export interface SentencePattern {
  pattern: string;
  explanation: string;
  examples: string[];
}

export interface PhraseCraftResult {
  original: string;
  intent_summary: string;
  cultural_tip: string;
  variations: PhraseVariation[];
  patterns: SentencePattern[];
}

export interface PhraseCraftInput {
  text: string;
}

import type {
  AiStatus,
  ApiErrorBody,
  AuthCredentials,
  AuthResult,
  AuthUser,
  ChatGoal,
  ChatStatus,
  ChatTopic,
  Conversation,
  ConversationPage,
  ConversationTurn,
  CreateConversationInput,
  CreateVocabularyEntryInput,
  ExerciseMode,
  GeneratedSentencesResult,
  GenerateSentencesInput,
  ProficiencyLevel,
  ReviewGrade,
  ReviewResult,
  SendTurnResult,
  SentenceValidationResponse,
  StudyHistoryPage,
  StudyOptions,
  StudySession,
  TranslateInput,
  TranslationResult,
  UpdateVocabularyEntryInput,
  VocabularyEntry,
  VocabularyPage,
} from "./types";

/**
 * In dev, Vite proxy forwards /api to backend; in prod/container
 * define VITE_API_URL (e.g. http://localhost:8000/api/v1).
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/$/, "");

const TOKEN_STORAGE_KEY = "piliplingo.token";

// Access token kept in memory and mirrored in localStorage.
let authToken: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Private mode / storage blocked: proceed without persisting.
    return null;
  }
}

/** Sets (or clears) the token used in all subsequent calls. */
export function setAuthToken(token: string | null): void {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore persistence error
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor.", 0, "network_error");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.message ?? `Falha na requisição (HTTP ${response.status}).`,
      response.status,
      errorBody?.error?.code ?? "http_error",
    );
  }

  return body as T;
}

export interface ListVocabularyParams {
  search?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface StudySessionParams {
  level: ProficiencyLevel;
  limit?: number;
  theme?: string | null;
  modes?: ExerciseMode[];
  reset?: boolean;
  signal?: AbortSignal;
}

export const authApi = {
  /** Creates account and returns token to login immediately. */
  register(input: AuthCredentials) {
    return request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Authenticates user + password. */
  login(input: AuthCredentials) {
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Authenticated user data; used to validate stored token on app launch. */
  me(signal?: AbortSignal) {
    return request<AuthUser>("/auth/me", { signal });
  },
};

export const vocabularyApi = {
  list({ search, limit = 50, offset = 0, signal }: ListVocabularyParams = {}) {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search?.trim()) {
      query.set("search", search.trim());
    }
    return request<VocabularyPage>(`/vocabulary?${query.toString()}`, { signal });
  },

  create(input: CreateVocabularyEntryInput) {
    return request<VocabularyEntry>("/vocabulary", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: UpdateVocabularyEntryInput) {
    return request<VocabularyEntry>(`/vocabulary/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(id: string) {
    return request<void>(`/vocabulary/${id}`, { method: "DELETE" });
  },

  /** Checks if AI sentence generation is configured in backend. */
  aiStatus(signal?: AbortSignal) {
    return request<AiStatus>("/vocabulary/sentences/status", { signal });
  },

  /** Generates example sentences at user level, optionally using saved vocabulary. */
  generateSentences(input: GenerateSentencesInput, signal?: AbortSignal) {
    return request<GeneratedSentencesResult>("/vocabulary/sentences/generate", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },

  /** Single source for modes and themes displayed in setup menu. */
  studyOptions(signal?: AbortSignal) {
    return request<StudyOptions>("/vocabulary/study/options", { signal });
  },

  /** Assembles study session after setup menu confirmation. */
  studySession({ level, limit, theme, modes, reset, signal }: StudySessionParams) {
    if (modes !== undefined && modes.length === 0) {
      throw new ApiError("Selecione pelo menos um formato de exercício.", 0, "empty_modes");
    }

    const query = new URLSearchParams({ level });
    if (limit) {
      query.set("limit", String(limit));
    }
    if (theme?.trim()) {
      query.set("theme", theme.trim());
    }
    if (reset) {
      query.set("reset", "true");
    }
    for (const mode of modes ?? []) {
      query.append("modes", mode);
    }
    return request<StudySession>(`/vocabulary/study/today?${query.toString()}`, { signal });
  },

  /** Discards generated cards that were never reviewed (abandoned session). */
  resetStudySession(level: ProficiencyLevel, signal?: AbortSignal) {
    const query = new URLSearchParams({ level });
    return request<{ deleted: number }>(`/vocabulary/study/reset?${query.toString()}`, {
      method: "POST",
      signal,
    });
  },

  /** Registers review result and reschedules card. */
  reviewCard(cardId: string, grade: ReviewGrade, signal?: AbortSignal) {
    return request<ReviewResult>(`/vocabulary/study/${cardId}/review`, {
      method: "POST",
      body: JSON.stringify({ grade }),
      signal,
    });
  },

  /** Paginated history of sentences and words seen by user. */
  studyHistory(
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ) {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return request<StudyHistoryPage>(`/vocabulary/study/history?${query.toString()}`, { signal });
  },

  /**
   * Saves words seen in a completed session.
   *
   * `translations` passes translations already present from AI vocabulary;
   * server falls back to external translator for missing terms.
   */
  saveSessionWords(
    words: string[],
    translations: Record<string, string> = {},
    signal?: AbortSignal,
  ) {
    return request<{ saved: number; translated: number }>("/vocabulary/study/session-words", {
      method: "POST",
      body: JSON.stringify({ words, translations }),
      signal,
    });
  },

  /** Validates sentence written by student in SENTENCE_BUILDER mode. */
  validateSentenceBuilder(
    sentence: string,
    focusTerm: string,
    signal?: AbortSignal,
  ) {
    return request<SentenceValidationResponse>(
      "/vocabulary/study/sentence-builder/validate",
      {
        method: "POST",
        body: JSON.stringify({ sentence, focus_term: focusTerm }),
        signal,
      },
    );
  },
};

export interface ListConversationsParams {
  limit?: number;
  offset?: number;
  status?: string;
  signal?: AbortSignal;
}

export const chatApi = {
  /** Checks if AI chat service is available. */
  status(signal?: AbortSignal) {
    return request<ChatStatus>("/chat/status", { signal });
  },

  /** Lists predefined topics. */
  topics(signal?: AbortSignal) {
    return request<ChatTopic[]>("/chat/topics", { signal });
  },

  /** Lists predefined goals. */
  goals(signal?: AbortSignal) {
    return request<ChatGoal[]>("/chat/goals", { signal });
  },

  /** Creates a new conversation. */
  createConversation(input: CreateConversationInput) {
    return request<Conversation>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Lists user conversations with pagination and optional status filter. */
  listConversations({ limit = 20, offset = 0, status, signal }: ListConversationsParams = {}) {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) query.set("status", status);
    return request<ConversationPage>(`/chat/conversations?${query.toString()}`, { signal });
  },

  /** Abandons an active conversation (DELETE -> 204). */
  deleteConversation(id: string) {
    return request<void>(`/chat/conversations/${id}`, { method: "DELETE" });
  },

  /** Completes an active conversation successfully (POST -> 200). */
  completeConversation(id: string, signal?: AbortSignal) {
    return request<Conversation>(`/chat/conversations/${id}/complete`, {
      method: "POST",
      signal,
    });
  },

  /** Sends message and receives AI reply. */
  sendTurn(conversationId: string, userMessage: string, signal?: AbortSignal) {
    return request<SendTurnResult>(`/chat/conversations/${conversationId}/turns`, {
      method: "POST",
      body: JSON.stringify({ user_message: userMessage }),
      signal,
    });
  },

  /** Lists all turns of a conversation in ascending order. */
  listTurns(conversationId: string, signal?: AbortSignal) {
    return request<ConversationTurn[]>(
      `/chat/conversations/${conversationId}/turns`,
      { signal },
    );
  },
};

export const translationApi = {
  /** Translates phrase and returns structural block analysis. */
  translate(input: TranslateInput, signal?: AbortSignal) {
    return request<TranslationResult>("/vocabulary/translate", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },
};

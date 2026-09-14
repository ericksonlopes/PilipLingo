import type {
  AiStatus,
  ApiErrorBody,
  AuthCredentials,
  AuthResult,
  AuthUser,
  CreateVocabularyEntryInput,
  ExerciseMode,
  GeneratedSentencesResult,
  GenerateSentencesInput,
  ProficiencyLevel,
  ReviewGrade,
  ReviewResult,
  StudyHistoryPage,
  StudyOptions,
  StudySession,
  UpdateVocabularyEntryInput,
  VocabularyEntry,
  VocabularyPage,
} from "./types";

/**
 * Em dev o proxy do Vite encaminha /api para o backend; em producao/container
 * defina VITE_API_URL (ex.: http://localhost:8000/api/v1).
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/$/, "");

const TOKEN_STORAGE_KEY = "piliplingo.token";

// Token de acesso mantido em memoria e espelhado no localStorage. Fica aqui, na
// camada de rede, para que toda requisicao ganhe o header Authorization sem que
// cada chamada precise se lembrar disso.
let authToken: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Modo privado/storage bloqueado: segue sem persistir.
    return null;
  }
}

/** Define (ou limpa) o token usado em todas as chamadas seguintes. */
export function setAuthToken(token: string | null): void {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignora falha de persistencia
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
    throw new ApiError("Sem conexao com o servidor.", 0, "network_error");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.message ?? `Falha na requisicao (HTTP ${response.status}).`,
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
  signal?: AbortSignal;
}

export const authApi = {
  /** Cria a conta e ja devolve o token para entrar direto. */
  register(input: AuthCredentials) {
    return request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Autentica usuario + senha. */
  login(input: AuthCredentials) {
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Dados do usuario logado; usado para validar o token guardado ao abrir o app. */
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

  /** Informa se a geracao de frases por IA esta configurada no backend. */
  aiStatus(signal?: AbortSignal) {
    return request<AiStatus>("/vocabulary/sentences/status", { signal });
  },

  /** Gera frases de exemplo no nivel do usuario, opcionalmente com o vocabulario salvo. */
  generateSentences(input: GenerateSentencesInput, signal?: AbortSignal) {
    return request<GeneratedSentencesResult>("/vocabulary/sentences/generate", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },

  /** Fonte unica dos modos e temas exibidos no menu de preparacao. */
  studyOptions(signal?: AbortSignal) {
    return request<StudyOptions>("/vocabulary/study/options", { signal });
  },

  /** Monta a sessao somente depois da confirmacao do menu de preparacao. */
  studySession({ level, limit, theme, modes, signal }: StudySessionParams) {
    if (modes !== undefined && modes.length === 0) {
      throw new ApiError("Selecione pelo menos um formato de exercicio.", 0, "empty_modes");
    }

    const query = new URLSearchParams({ level });
    if (limit) {
      query.set("limit", String(limit));
    }
    if (theme?.trim()) {
      query.set("theme", theme.trim());
    }
    for (const mode of modes ?? []) {
      query.append("modes", mode);
    }
    return request<StudySession>(`/vocabulary/study/today?${query.toString()}`, { signal });
  },

  /** Registra o resultado da revisao e reagenda o card. */
  reviewCard(cardId: string, grade: ReviewGrade, signal?: AbortSignal) {
    return request<ReviewResult>(`/vocabulary/study/${cardId}/review`, {
      method: "POST",
      body: JSON.stringify({ grade }),
      signal,
    });
  },

  /** Historico paginado de frases e palavras vistas pelo usuario. */
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

  /** Traduz e salva as palavras (focus_terms) de uma sessao concluida. */
  saveSessionWords(words: string[], signal?: AbortSignal) {
    return request<{ saved: number; translated: number }>("/vocabulary/study/session-words", {
      method: "POST",
      body: JSON.stringify({ words }),
      signal,
    });
  },
};

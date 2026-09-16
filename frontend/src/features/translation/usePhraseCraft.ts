/**
 * State hook for phrase crafting ("Construir Frases").
 * Helps Brazilian Portuguese learners formulate native-like English sentences,
 * explore structural patterns, and understand cultural/pragmatic etiquette.
 */
import { useCallback, useRef, useState } from "react";

import { ApiError, translationApi } from "../../lib/api";
import type { PhraseCraftResult } from "../../lib/types";

export const CRAFT_MAX_CHARS = 1000;

export const CRAFT_QUICK_PROMPTS = [
  "eu quero pizza",
  "pedir a conta no restaurante",
  "chamar um táxi",
  "onde fica a estação",
];

export interface UsePhraseCraftReturn {
  text: string;
  setText: (value: string) => void;
  result: PhraseCraftResult | null;
  loading: boolean;
  error: string | null;
  canSubmit: boolean;
  charCount: number;
  craftPhrase: (customText?: string) => Promise<void>;
  clear: () => void;
  quickPrompts: string[];
}

export function usePhraseCraft(): UsePhraseCraftReturn {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PhraseCraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = text.trim();
  const charCount = text.length;
  const canSubmit = trimmed.length > 0 && charCount <= CRAFT_MAX_CHARS && !loading;

  const craftPhrase = useCallback(
    async (customText?: string) => {
      const target = (customText !== undefined ? customText : text).trim();
      if (!target || loading) return;

      if (customText !== undefined) {
        setText(customText);
      }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const data = await translationApi.craftPhrase({ text: target }, ctrl.signal);
        setResult(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof ApiError) {
          setError(
            err.status === 503
              ? "Serviço de IA indisponível no momento. Tente novamente em breve."
              : err.message,
          );
        } else {
          setError("Erro inesperado. Verifique sua conexão e tente novamente.");
        }
      } finally {
        setLoading(false);
      }
    },
    [text, loading],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setText("");
    setResult(null);
    setError(null);
  }, []);

  return {
    text,
    setText,
    result,
    loading,
    error,
    canSubmit,
    charCount,
    craftPhrase,
    clear,
    quickPrompts: CRAFT_QUICK_PROMPTS,
  };
}

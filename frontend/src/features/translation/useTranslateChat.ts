/**
 * Hook de estado do chat de tradução.
 * Cada "turno" é uma mensagem do usuário + o resultado da análise (ou erro).
 */
import { useCallback, useRef, useState } from "react";

import { ApiError, translationApi } from "../../lib/api";
import type { TranslationResult } from "../../lib/types";

export interface TranslateTurn {
  id: string;
  userText: string;
  result: TranslationResult | null;
  error: string | null;
  /** Ainda aguardando resposta da API */
  pending: boolean;
}

export interface UseTranslateChatReturn {
  turns: TranslateTurn[];
  isTyping: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

export function useTranslateChat(): UseTranslateChatReturn {
  const [turns, setTurns] = useState<TranslateTurn[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const id = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Insere turno pendente imediatamente (mensagem otimista)
    const pending: TranslateTurn = {
      id,
      userText: trimmed,
      result: null,
      error: null,
      pending: true,
    };
    setTurns((prev) => [...prev, pending]);
    setIsTyping(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await translationApi.translate({ text: trimmed }, ctrl.signal);

      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, result, pending: false } : t
        )
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      let message = "Erro inesperado. Tente novamente.";
      if (err instanceof ApiError) {
        message =
          err.status === 503
            ? "Serviço de IA indisponível no momento."
            : err.message;
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, error: message, pending: false } : t
        )
      );
    } finally {
      setIsTyping(false);
    }
  }, [isTyping]);

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setIsTyping(false);
  }, []);

  return { turns, isTyping, sendMessage, clearHistory };
}

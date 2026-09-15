import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, vocabularyApi } from "../lib/api";
import type { StudyHistoryPage } from "../lib/types";

const PAGE_SIZE = 50;

interface UseStudyHistoryResult {
  history: StudyHistoryPage | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetches history of sentences and words seen by user.
 * Fetch occurs only when `enabled` is true.
 */
export function useStudyHistory(enabled: boolean): UseStudyHistoryResult {
  const [history, setHistory] = useState<StudyHistoryPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let active = true;

    setIsLoading(true);
    setError(null);

    vocabularyApi
      .studyHistory({ limit: PAGE_SIZE, offset: 0 }, controller.signal)
      .then((page) => {
        if (!active) return;
        setHistory(page);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(
          cause instanceof ApiError ? cause.message : "Não foi possível carregar o histórico.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { history, isLoading, error, reload };
}

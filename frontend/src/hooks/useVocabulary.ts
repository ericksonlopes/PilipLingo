import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, vocabularyApi } from "../lib/api";
import type {
  CreateVocabularyEntryInput,
  UpdateVocabularyEntryInput,
  VocabularyEntry,
} from "../lib/types";

interface UseVocabularyResult {
  entries: VocabularyEntry[];
  total: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  createEntry: (input: CreateVocabularyEntryInput) => Promise<VocabularyEntry>;
  updateEntry: (id: string, input: UpdateVocabularyEntryInput) => Promise<VocabularyEntry>;
  removeEntry: (id: string) => Promise<void>;
}

/** Estado da lista de vocabulario com busca debounced e cancelamento de request. */
export function useVocabulary(search: string): UseVocabularyResult {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setIsLoading(true);
    vocabularyApi
      .list({ search: debouncedSearch, signal: controller.signal })
      .then((page) => {
        if (!active) return;
        setEntries(page.items);
        setTotal(page.total);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.message : "Nao foi possivel carregar.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedSearch, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const createEntry = useCallback(async (input: CreateVocabularyEntryInput) => {
    const created = await vocabularyApi.create(input);
    setEntries((current) => [created, ...current]);
    setTotal((current) => current + 1);
    return created;
  }, []);

  const updateEntry = useCallback(async (id: string, input: UpdateVocabularyEntryInput) => {
    const updated = await vocabularyApi.update(id, input);
    setEntries((current) => current.map((entry) => (entry.id === id ? updated : entry)));
    return updated;
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    await vocabularyApi.remove(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setTotal((current) => Math.max(0, current - 1));
  }, []);

  return { entries, total, isLoading, error, reload, createEntry, updateEntry, removeEntry };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timeout.current = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout.current);
  }, [value, delayMs]);

  return debounced;
}

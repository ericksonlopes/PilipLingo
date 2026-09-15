import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, vocabularyApi } from "../lib/api";
import type {
  ExerciseMode,
  ProficiencyLevel,
  ReviewGrade,
  StudyExercise,
  StudySession,
} from "../lib/types";

interface UseStudySessionOptions {
  enabled: boolean;
  modes: ExerciseMode[];
  theme: string | null;
  limit?: number;
}

interface UseStudySessionResult {
  session: StudySession | null;
  current: StudyExercise | null;
  index: number;
  completed: number;
  skipped: number;
  isLoading: boolean;
  isFinished: boolean;
  error: string | null;
  /** Advances locally and queues review submission asynchronously. */
  submitReview: (grade: ReviewGrade) => Promise<void>;
  /** Skips to next exercise without recording review. */
  skip: () => void;
  /** Invalidates pending operations and resets current session. */
  reset: () => void;
  reload: () => void;
}

/**
 * Study session state management.
 */
export function useStudySession(
  level: ProficiencyLevel,
  { enabled, modes, theme, limit }: UseStudySessionOptions,
): UseStudySessionResult {
  const [session, setSession] = useState<StudySession | null>(null);
  const [queue, setQueue] = useState<StudyExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const isMounted = useRef(true);
  const wordsSavedRef = useRef<number>(-1);
  const finishedQueueRef = useRef<StudyExercise[]>([]);
  const modesKey = modes.join("\u001f");
  const sessionVersion = useRef(0);
  const submittedReview = useRef<{ version: number; index: number } | null>(null);
  const reviewRequestId = useRef(0);
  const latestReviewFailureId = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      sessionVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    const version = ++sessionVersion.current;

    if (!enabled) {
      setSession(null);
      setQueue([]);
      setIndex(0);
      setCompleted(0);
      setSkipped(0);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    if (modesKey === "") {
      setSession(null);
      setQueue([]);
      setIsLoading(false);
      setError("Selecione pelo menos um formato de exercício.");
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const requestedModes = modesKey.split("\u001f") as ExerciseMode[];

    setSession(null);
    setQueue([]);
    setIsLoading(true);
    setError(null);
    vocabularyApi
      .studySession({
        level,
        modes: requestedModes,
        theme,
        limit,
        reset: true,
        signal: controller.signal,
      })
      .then((result) => {
        if (!active || sessionVersion.current !== version) return;
        setSession(result);
        setQueue(result.exercises);
        setIndex(0);
        setCompleted(0);
        setSkipped(0);
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted || sessionVersion.current !== version) return;
        setError(
          cause instanceof ApiError ? cause.message : "Não foi possível montar a sessão.",
        );
      })
      .finally(() => {
        if (active && sessionVersion.current === version) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, level, limit, modesKey, reloadToken, theme]);

  const submitReview = useCallback(
    (grade: ReviewGrade): Promise<void> => {
      const exercise = queue[index];
      if (exercise === undefined) {
        return Promise.resolve();
      }
      const version = sessionVersion.current;
      const previousSubmission = submittedReview.current;
      if (
        previousSubmission?.version === version &&
        previousSubmission.index === index
      ) {
        return Promise.resolve();
      }
      submittedReview.current = { version, index };
      const requestId = ++reviewRequestId.current;

      if (grade === "AGAIN") {
        setQueue((current) => [...current, exercise]);
      } else {
        setCompleted((value) => value + 1);
      }
      setIndex((value) => value + 1);

      void vocabularyApi
        .reviewCard(exercise.card.id, grade)
        .then(() => {
          if (
            isMounted.current &&
            sessionVersion.current === version &&
            requestId >= latestReviewFailureId.current
          ) {
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (isMounted.current && sessionVersion.current === version) {
            latestReviewFailureId.current = Math.max(
              latestReviewFailureId.current,
              requestId,
            );
            setError(
              cause instanceof ApiError
                ? `Progresso não salvo: ${cause.message}`
                : "Progresso deste card não foi salvo.",
            );
          }
        });

      return Promise.resolve();
    },
    [index, queue],
  );

  const skip = useCallback(() => {
    setSkipped((value) => value + 1);
    setIndex((value) => value + 1);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    sessionVersion.current += 1;
    wordsSavedRef.current = -1;
    setReloadToken((token) => token + 1);
    setSession(null);
    setQueue([]);
    setIndex(0);
    setCompleted(0);
    setSkipped(0);
    setIsLoading(false);
    setError(null);
  }, []);

  const reload = useCallback(() => {
    sessionVersion.current += 1;
    wordsSavedRef.current = -1;
    setReloadToken((token) => token + 1);
  }, []);

  const isFinished = !isLoading && error === null && queue.length > 0 && index >= queue.length;
  if (isFinished && wordsSavedRef.current !== sessionVersion.current) {
    finishedQueueRef.current = queue;
  }

  useEffect(() => {
    if (!isFinished) return;
    const version = sessionVersion.current;
    if (wordsSavedRef.current === version) return;
    wordsSavedRef.current = version;

    const snapshot = finishedQueueRef.current;

    const translations: Record<string, string> = {};
    const words = [
      ...new Set(
        snapshot.flatMap((ex) => {
          const vocab = ex.card.vocabulary ?? [];
          for (const item of vocab) {
            if (item.term && item.translation) {
              translations[item.term] = item.translation;
            }
          }
          const terms = vocab.map((item) => item.term);
          if (terms.length > 0) {
            return terms;
          }
          if (ex.card.focus_term && ex.card.focus_term_translation) {
            translations[ex.card.focus_term] = ex.card.focus_term_translation;
          }
          return [ex.card.focus_term];
        }).filter(Boolean),
      ),
    ];
    if (words.length === 0) return;

    void vocabularyApi.saveSessionWords(words, translations).catch(() => {
      // Ignore network errors silently
    });
  }, [isFinished]);

  return {
    session,
    current: queue[index] ?? null,
    index,
    completed,
    skipped,
    isLoading,
    isFinished,
    error,
    submitReview,
    skip,
    reset,
    reload,
  };
}

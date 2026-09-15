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
  /** Avanca localmente e agenda o envio da nota sem bloquear a sessao. */
  submitReview: (grade: ReviewGrade) => Promise<void>;
  /** Passa para o proximo exercicio sem registrar revisao. */
  skip: () => void;
  /** Invalida operacoes pendentes e limpa a sessao atual. */
  reset: () => void;
  reload: () => void;
}

/**
 * Estado da sessao de estudo, carregada apenas depois da confirmacao do menu.
 *
 * Regra que espelha o backend: nota `AGAIN` recoloca o exercicio no fim da fila
 * da propria sessao, em vez de deixar para outro dia. O card errado tem que
 * voltar antes do aluno fechar o app.
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
  // Evita disparar saveSessionWords mais de uma vez por versao de sessao.
  const wordsSavedRef = useRef<number>(-1);
  // Snapshot da queue no momento em que a sessao termina. Necessario porque
  // reset() zera queue[] de forma sincrona antes que o useEffect de
  // saveSessionWords possa disparar, causando envio com lista vazia.
  const finishedQueueRef = useRef<StudyExercise[]>([]);
  // A chave depende do conteudo, nao da identidade do array recebido. Assim uma
  // renderizacao com a mesma selecao nao dispara outro fetch.
  const modesKey = modes.join("\u001f");
  // Cada configuracao recebe uma geracao. Respostas antigas podem terminar no
  // servidor, mas nunca podem alterar a fila de uma sessao mais nova.
  const sessionVersion = useRef(0);
  // Impede dois envios do mesmo exercicio enquanto o React ainda nao publicou o
  // novo indice e ordena o feedback de requests que terminam fora de ordem.
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
      setError("Selecione pelo menos um formato de exercicio.");
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
          cause instanceof ApiError ? cause.message : "Nao foi possivel montar a sessao.",
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

      // O avanco local acontece antes de iniciar o POST. Continuar e avanco
      // automatico nunca ficam presos a latencia ou indisponibilidade da rede.
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
            // Um sucesso antigo nao apaga a mensagem de uma tentativa mais nova.
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          // Perder a rede nao desfaz o avanco. O agendamento desse card fica como
          // estava e ele volta em uma proxima sessao.
          if (isMounted.current && sessionVersion.current === version) {
            latestReviewFailureId.current = Math.max(
              latestReviewFailureId.current,
              requestId,
            );
            setError(
              cause instanceof ApiError
                ? `Progresso nao salvo: ${cause.message}`
                : "Progresso deste card nao foi salvo.",
            );
          }
        });

      return Promise.resolve();
    },
    [index, queue],
  );

  /**
   * Pular nao e uma nota: nada e enviado ao backend, entao o agendamento do card
   * fica intacto e ele reaparece numa sessao futura no lugar em que estava.
   *
   * O exercicio pulado tambem nao volta para o fim da fila desta sessao, ao
   * contrario do `AGAIN`. Quem pula geralmente esta impedido de responder (sem
   * microfone, sem fone, no onibus), e requeue ali viraria um loop no mesmo
   * obstaculo.
   */
  const skip = useCallback(() => {
    setSkipped((value) => value + 1);
    setIndex((value) => value + 1);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    // A ref muda de forma sincrona, antes mesmo do proximo render. Reviews e
    // fetches pendentes deixam de poder alterar qualquer estado imediatamente.
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
    // Snapshot da queue no render em que isFinished se torna true.
    // O reset() chamado logo em seguida vai zerar queue[], mas a ref ja tem o snapshot.
    finishedQueueRef.current = queue;
  }

  // Ao terminar a sessao, envia os focus_terms unicos para o backend traduzir
  // e salvar. Fire-and-forget: falha de rede nao interrompe o fluxo do aluno.
  // Usa finishedQueueRef em vez de queue para nao depender do estado que reset() apaga.
  useEffect(() => {
    if (!isFinished) return;
    const version = sessionVersion.current;
    if (wordsSavedRef.current === version) return; // ja enviou nesta versao
    wordsSavedRef.current = version;

    // Usa o snapshot capturado no render em que isFinished ficou true.
    // Se reset() ja tiver zerado queue[], finishedQueueRef ainda tem os dados corretos.
    const snapshot = finishedQueueRef.current;

    // Junta todo o vocabulario de cada card (varias palavras por frase) e cai
    // no focus_term quando um card antigo nao tem vocabulario. Junto vai o mapa
    // termo -> traducao que a IA ja gerou, para o backend nao depender do
    // tradutor externo (limitado por rate limit) para preencher o historico.
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
          // Card antigo sem vocabulario: usa focus_term e sua traducao, se houver.
          if (ex.card.focus_term && ex.card.focus_term_translation) {
            translations[ex.card.focus_term] = ex.card.focus_term_translation;
          }
          return [ex.card.focus_term];
        }).filter(Boolean),
      ),
    ];
    if (words.length === 0) return;

    void vocabularyApi.saveSessionWords(words, translations).catch(() => {
      // Silencioso: nao prejudica a experiencia do aluno.
    });
  }, [isFinished]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intencional: a dependencia de 'queue' foi removida pois usamos finishedQueueRef
  // (snapshot capturado no render). Adicionar queue causaria o bug original:
  // reset() zera queue antes do effect rodar, resultando em envio com lista vazia.

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

import { useEffect, useRef, useState } from "react";

import { ACTION_BAR_SLOT_ID } from "../components/study/ActionBarSlot";
import BlockAssembly from "../components/study/BlockAssembly";
import ChunkAnalysis from "../components/study/ChunkAnalysis";
import GradeBar from "../components/study/GradeBar";
import SentenceBuilder from "../components/study/SentenceBuilder";
import SpeakingPractice from "../components/study/SpeakingPractice";
import StudySetup from "../components/study/StudySetup";
import TypingCloze from "../components/study/TypingCloze";
import VocabMatching from "../components/study/VocabMatching";
import { usePersistedStudySetup } from "../hooks/usePersistedStudySetup";
import { useStudySession } from "../hooks/useStudySession";
import { ApiError, vocabularyApi } from "../lib/api";
import { speak, stopSpeaking, waitForSpeechIdle } from "../lib/speech";
import type {
  ExerciseMode,
  ProficiencyLevel,
  StudyExercise,
  StudyOptions,
} from "../lib/types";

interface StudyPageProps {
  level: ProficiencyLevel;
}

interface ExerciseResolution {
  index: number;
  wasCorrect: boolean;
}


/** Menu de preparacao e sessao de estudo, um exercicio por vez. */
export default function StudyPage({ level }: StudyPageProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [options, setOptions] = useState<StudyOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsReloadToken, setOptionsReloadToken] = useState(0);

  const {
    selectedModes,
    setSelectedModes,
    selectedTheme,
    setSelectedTheme,
    sessionLimit,
    setSessionLimit,
  } = usePersistedStudySetup(options?.modes.map((o) => o.mode) ?? []);
  const {
    session,
    current,
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
  } = useStudySession(level, {
    enabled: hasStarted,
    modes: selectedModes,
    theme: selectedTheme,
    limit: sessionLimit,
  });
  const [resolution, setResolution] = useState<ExerciseResolution | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Desativado por padrao: o aluno decide quando avancar. Evita pular a correcao
  // antes de ler o feedback.
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const setupHeadingRef = useRef<HTMLHeadingElement>(null);
  const exerciseHeadingRef = useRef<HTMLParagraphElement>(null);
  const previousHasStarted = useRef(hasStarted);
  const resolutionRef = useRef<ExerciseResolution | null>(null);
  const currentIndexRef = useRef(index);
  const submitLockRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);
  const autoAdvanceControllerRef = useRef<AbortController | null>(null);
  currentIndexRef.current = index;

  useEffect(() => {
    if (previousHasStarted.current && !hasStarted) {
      setupHeadingRef.current?.focus();
    }
    previousHasStarted.current = hasStarted;
  }, [hasStarted]);

  // Ao trocar o bloco inteiro da tela, entrega o foco ao novo exercicio.
  useEffect(() => {
    if (!hasStarted || isLoading || current === null) return undefined;
    const frame = requestAnimationFrame(() => exerciseHeadingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [current, hasStarted, index, isLoading]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setOptionsLoading(true);
    setOptionsError(null);
    vocabularyApi
      .studyOptions(controller.signal)
      .then((result) => {
        if (!active) return;
        setOptions(result);
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setOptionsError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar as opções de estudo.",
        );
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [optionsReloadToken]);

  // Cada exercicio comeca do zero, e nenhuma frase continua tocando ao trocar.
  useEffect(() => {
    autoAdvanceControllerRef.current?.abort();
    resolutionRef.current = null;
    submitLockRef.current = false;
    setResolution(null);
    setIsSaving(false);
    stopSpeaking();
  }, [index]);

  useEffect(() => {
    return () => {
      autoAdvanceControllerRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  // Sem chave de IA a revisao continua, mas o tema nao gera frases novas.
  useEffect(() => {
    const controller = new AbortController();
    vocabularyApi
      .aiStatus(controller.signal)
      .then((status) => setIsAiEnabled(status.enabled))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  function toggleMode(mode: ExerciseMode) {
    setSelectedModes((current) =>
      current.includes(mode)
        ? current.filter((selected) => selected !== mode)
        : [...current, mode],
    );
  }

  function returnToSetup() {
    autoAdvanceControllerRef.current?.abort();
    stopSpeaking();
    reset();
    setHasStarted(false);
    resolutionRef.current = null;
    submitLockRef.current = false;
    setResolution(null);
    setIsSaving(false);
  }

  function changeAutoAdvance(enabled: boolean) {
    autoAdvanceRef.current = enabled;
    setAutoAdvance(enabled);
    if (!enabled) autoAdvanceControllerRef.current?.abort();
  }

  function resolveExercise(wasCorrect: boolean) {
    if (
      current === null ||
      currentIndexRef.current !== index ||
      resolutionRef.current?.index === index
    ) {
      return;
    }

    const nextResolution = { index, wasCorrect };
    resolutionRef.current = nextResolution;
    setResolution(nextResolution);
    void speak(current.card.sentence);
  }

  function retryExercise() {
    autoAdvanceControllerRef.current?.abort();
    stopSpeaking();
    resolutionRef.current = null;
    submitLockRef.current = false;
    setResolution(null);
    setIsSaving(false);
  }

  async function continueResolved(
    expectedIndex: number,
    wasCorrect: boolean,
    cancelSpeech: boolean,
  ) {
    if (currentIndexRef.current !== expectedIndex || submitLockRef.current) return;

    submitLockRef.current = true;
    autoAdvanceControllerRef.current?.abort();
    if (cancelSpeech) stopSpeaking();
    setIsSaving(true);
    try {
      await submitReview(wasCorrect ? "GOOD" : "AGAIN");
    } finally {
      submitLockRef.current = false;
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (
      !hasStarted ||
      !autoAdvance ||
      resolution === null ||
      resolution.index !== index
    ) {
      return undefined;
    }

    const controller = new AbortController();
    autoAdvanceControllerRef.current = controller;
    void waitForSpeechIdle(800, controller.signal).then(() => {
      if (
        controller.signal.aborted ||
        !autoAdvanceRef.current ||
        currentIndexRef.current !== resolution.index
      ) {
        return;
      }
      void continueResolved(resolution.index, resolution.wasCorrect, false);
    });

    return () => {
      controller.abort();
      if (autoAdvanceControllerRef.current === controller) {
        autoAdvanceControllerRef.current = null;
      }
    };
  }, [autoAdvance, hasStarted, index, resolution]);

  if (!hasStarted) {
    return (
      <StudySetup
        headingRef={setupHeadingRef}
        isLoading={optionsLoading}
        error={optionsError}
        options={options}
        isAiEnabled={isAiEnabled}
        selectedModes={selectedModes}
        selectedTheme={selectedTheme}
        sessionLimit={sessionLimit}
        onToggleMode={toggleMode}
        onSelectAllModes={() => setSelectedModes(options?.modes.map((m) => m.mode) ?? [])}
        onClearModes={() => setSelectedModes([])}
        onThemeChange={setSelectedTheme}
        onSessionLimitChange={setSessionLimit}
        onRetryLoad={() => setOptionsReloadToken((t) => t + 1)}
        onStart={() => {
          if (selectedModes.length > 0) setHasStarted(true);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <section className="page" aria-busy="true">
        <div className="study-head">
          <p className="page__meta" role="status" aria-live="polite">
            Montando sua sessão...
          </p>
          <button type="button" className="btn btn--sm" onClick={returnToSetup}>
            Voltar
          </button>
        </div>
      </section>
    );
  }

  if (error !== null && session === null) {
    return (
      <section className="page">
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={reload}>
            Tentar de novo
          </button>
        </div>
        <button type="button" className="btn btn--ghost btn--block" onClick={returnToSetup}>
          Alterar configuração
        </button>
      </section>
    );
  }

  if (isFinished || current === null) {
    const activeThemeLabel =
      options?.themes.find((t) => t.theme === selectedTheme)?.label ??
      selectedTheme ??
      "Tema surpresa / variado";

    return (
      <section className="page">
        <div className="study-completed">
          <div className="study-completed__badge" aria-hidden="true">
            🎉
          </div>
          <h2 className="study-completed__title">Sessão concluída!</h2>
          <p className="study-completed__subtitle">
            Excelente prática! Você completou sua meta diária de estudos no nível{" "}
            <strong>{level}</strong>.
          </p>

          <div className="study-completed__stats">
            <div className="study-completed__stat-card">
              <span className="study-completed__stat-value">{completed}</span>
              <span className="study-completed__stat-label">
                {completed === 1 ? "Exercício feito" : "Exercícios feitos"}
              </span>
            </div>

            <div className="study-completed__stat-card">
              <span className="study-completed__stat-value">
                {skipped > 0 ? skipped : "0"}
              </span>
              <span className="study-completed__stat-label">
                {skipped === 1 ? "Exercício pulado" : "Exercícios pulados"}
              </span>
            </div>

            <div className="study-completed__stat-card study-completed__stat-card--wide">
              <span className="study-completed__stat-sublabel">Tema da prática:</span>
              <span className="study-completed__stat-text">{activeThemeLabel}</span>
            </div>
          </div>

          <p className="study-completed__info">
            Os cards concluídos foram atualizados com repetição espaçada para maximizar a retenção.
          </p>

          <div className="study-completed__actions">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                reset();
                reload();
              }}
            >
              Estudar novamente ({sessionLimit} exercícios)
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={returnToSetup}
            >
              Ajustar formatos e temas
            </button>
          </div>
        </div>
      </section>
    );
  }

  const total = session?.exercises.length ?? 0;
  const currentResolution = resolution?.index === index ? resolution : null;

  return (
    <section className="page page--study">
      <div className="study-head">
        <p className="page__meta">
          {index + 1} de {Math.max(total, index + 1)}
          {session !== null && session.due_count > 0
            ? ` · ${session.due_count} para revisar`
            : null}
          {session !== null && session.ahead_count > 0 && session.due_count === 0
            ? " · estudo adiantado"
            : null}
        </p>
        <button
          type="button"
          className="btn btn--sm"
          disabled={isSaving}
          onClick={returnToSetup}
        >
          Alterar
        </button>
      </div>

      <div className="progress" aria-hidden="true">
        <span
          className="progress__bar"
          style={{ width: `${(index / Math.max(total, index + 1)) * 100}%` }}
        />
      </div>

      {!isAiEnabled ? (
        <p className="alert alert--warn" role="status">
          Frases novas estão desligadas. A revisão dos cards existentes continua funcionando.
        </p>
      ) : null}

      <div className="panel">
        <p
          ref={exerciseHeadingRef}
          className="exercise__instruction"
          tabIndex={-1}
        >
          {current.instruction}
        </p>
        <ExerciseView
          key={index}
          exercise={current}
          isResolved={currentResolution !== null}
          onResolve={resolveExercise}
          onRetry={retryExercise}
        />
      </div>

      {error !== null ? (
        <p className="alert alert--warn" role="status">
          {error}
        </p>
      ) : null}

      {currentResolution !== null ? <ChunkAnalysis card={current.card} /> : null}

      {/* Barra de acoes fixa no rodape. O "Pular" fica sempre disponivel; quando o
          exercicio e resolvido, ele sobe e da lugar a barra de Continuar. O slot
          recebe os botoes de acao do exercicio (ex.: "Verificar") via portal. */}
      <div className="study-actions">
        {/* Alvo do portal: os modos renderizam aqui o "Verificar"/"Dica". */}
        <div id={ACTION_BAR_SLOT_ID} className="study-actions__slot" />

        {/* Escape para quando responder nao e possivel: microfone sem permissao,
            sem fone para o ditado, ambiente barulhento. Nao vira nota, entao o card
            volta como estava em vez de ser marcado como erro. So aparece antes de
            resolver: uma vez corrigido, a unica acao e "Continuar". */}
        {currentResolution === null ? (
          <button
            type="button"
            className="btn btn--ghost skip"
            onClick={() => {
              stopSpeaking();
              skip();
            }}
          >
            Pular exercício
          </button>
        ) : null}

        {currentResolution !== null ? (
          <GradeBar
            isSaving={isSaving}
            autoAdvance={autoAdvance}
            onAutoAdvanceChange={changeAutoAdvance}
            onContinue={() => {
              void continueResolved(index, currentResolution.wasCorrect, true);
            }}
          />
        ) : null}
      </div>
    </section>
  );
}


interface ExerciseViewProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
  onRetry: () => void;
}

/** Escolhe o componente do modo definido para o exercicio. */
function ExerciseView({
  exercise,
  isResolved,
  onResolve,
  onRetry,
}: ExerciseViewProps) {
  switch (exercise.mode) {
    case "TYPING_CLOZE":
      return (
        <TypingCloze exercise={exercise} isResolved={isResolved} onResolve={onResolve} />
      );
    case "AUDIO_DICTATION":
    case "BLOCK_TRANSLATION":
      return (
        <BlockAssembly exercise={exercise} isResolved={isResolved} onResolve={onResolve} />
      );
    case "VOCAB_MATCHING":
      return (
        <VocabMatching exercise={exercise} isResolved={isResolved} onResolve={onResolve} />
      );
    case "SPEAKING_PRACTICE":
      return (
        <SpeakingPractice
          exercise={exercise}
          isResolved={isResolved}
          onResolve={onResolve}
          onRetry={onRetry}
        />
      );
    case "SENTENCE_BUILDER":
      return (
        <SentenceBuilder
          exercise={exercise}
          isResolved={isResolved}
          onResolve={onResolve}
        />
      );
  }
}

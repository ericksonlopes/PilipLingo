import { useEffect, useRef, useState } from "react";

import { bestSimilarity, isSpokenAnswerAccepted } from "../../lib/answers";
import {
  createRecognizer,
  isMicAllowedHere,
  isRecognitionSupported,
  type SpeechRecognizer,
  stopSpeaking,
  transcriptsOf,
} from "../../lib/speech";
import type { StudyExercise } from "../../lib/types";
import AudioButton from "./AudioButton";

interface SpeakingPracticeProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
  onRetry: () => void;
}

type MicState = "idle" | "listening" | "denied" | "silent" | "failed";

const MIC_MESSAGES: Record<"denied" | "silent" | "failed", string> = {
  denied:
    "O navegador negou o microfone. Libere a permissao para este site e tente de novo.",
  silent:
    "Nao captei nenhuma fala. Verifique se o microfone certo esta selecionado e fale mais perto.",
  failed:
    "O reconhecimento de fala falhou. Ele precisa de internet para funcionar; tente novamente.",
};

/**
 * Modo 5: ouvir e repetir em voz alta.
 *
 * O reconhecimento roda no navegador (Web Speech API), nada de audio sai do
 * aparelho. A comparacao e por similaridade e nao exata: o reconhecedor troca
 * palavras parecidas e engole artigos, e reprovar o aluno por isso seria medir o
 * microfone, nao o ingles.
 *
 * Nem todo navegador tem a API (Firefox, por exemplo). Nesse caso o exercicio nao
 * trava: o aluno ouve, repete e confirma que concluiu.
 */
export default function SpeakingPractice({
  exercise,
  isResolved,
  onResolve,
  onRetry,
}: SpeakingPracticeProps) {
  const [micState, setMicState] = useState<MicState>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isTextVisible, setIsTextVisible] = useState(false);
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const sentenceId = `speaking-sentence-${exercise.card.id}`;
  const canListen = isRecognitionSupported() && isMicAllowedHere();

  function releaseRecognizer(instance: SpeechRecognizer, shouldAbort: boolean): void {
    instance.onresult = null;
    instance.onerror = null;
    instance.onend = null;
    if (recognizer.current === instance) recognizer.current = null;
    if (shouldAbort) instance.abort();
  }

  // Solta o microfone e a fala ao trocar de exercicio ou sair da tela.
  useEffect(() => {
    return () => {
      const activeRecognizer = recognizer.current;
      if (activeRecognizer !== null) releaseRecognizer(activeRecognizer, true);
      stopSpeaking();
    };
  }, []);

  function listen() {
    const previousRecognizer = recognizer.current;
    if (previousRecognizer !== null) releaseRecognizer(previousRecognizer, true);

    const instance = createRecognizer();
    if (instance === null) {
      setMicState("denied");
      return;
    }

    stopSpeaking();
    recognizer.current = instance;
    // Este estado pertence apenas a esta instancia. Uma tentativa anterior nunca
    // pode decidir se o onend da tentativa atual ouviu alguma coisa.
    let gotResult = false;
    setHeard(null);
    setMicState("listening");

    instance.onresult = (event) => {
      if (recognizer.current !== instance) return;
      const transcripts = transcriptsOf(event);
      const accepted = isSpokenAnswerAccepted(transcripts, exercise.answer);
      gotResult = true;
      // Desconecta antes da voz automatica iniciada por onResolve, para ela nao
      // voltar pelo microfone como se fosse uma segunda resposta do aluno.
      releaseRecognizer(instance, true);
      setHeard(transcripts[0] ?? "");
      setScore(bestSimilarity(transcripts, exercise.answer));
      setMicState("idle");
      onResolve(accepted);
    };

    instance.onerror = (event) => {
      if (recognizer.current !== instance) return;
      gotResult = true;
      releaseRecognizer(instance, true);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicState("denied");
      } else if (event.error === "no-speech" || event.error === "aborted") {
        setMicState("silent");
      } else {
        // `network` e `audio-capture` caem aqui: o motor de reconhecimento do
        // Chrome depende de servidor, entao offline nunca devolve resultado.
        setMicState("failed");
      }
    };

    instance.onend = () => {
      if (recognizer.current !== instance) return;
      releaseRecognizer(instance, false);
      // Encerrou sem resultado nem erro: microfone mudo ou fala nao reconhecida.
      setMicState((current) =>
        current === "listening" ? (gotResult ? "idle" : "silent") : current,
      );
    };

    try {
      instance.start();
    } catch {
      if (recognizer.current !== instance) return;
      releaseRecognizer(instance, true);
      setMicState("failed");
    }
  }

  function retryRecording() {
    setHeard(null);
    setScore(0);
    setMicState("idle");
    onRetry();
    listen();
  }

  return (
    <div className="exercise">
      <AudioButton
        text={exercise.card.sentence}
        label="Ouvir o modelo"
        disabled={micState === "listening"}
      />

      {!isResolved ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => setIsTextVisible((visible) => !visible)}
          aria-expanded={isTextVisible}
          aria-controls={sentenceId}
        >
          {isTextVisible ? "Ocultar texto em inglês" : "Ver texto em inglês"}
        </button>
      ) : null}

      <p
        id={sentenceId}
        className="exercise__sentence"
        lang="en"
        hidden={!isResolved && !isTextVisible}
      >
        {exercise.card.sentence}
      </p>

      {!isResolved ? <p className="exercise__hint">{exercise.card.translation}</p> : null}

      {canListen && !isResolved ? (
        <button
          type="button"
          className={`mic${micState === "listening" ? " mic--listening" : ""}`}
          onClick={listen}
          disabled={micState === "listening"}
          aria-label={micState === "listening" ? "Ouvindo voce" : "Falar a frase"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect
              x="9"
              y="3"
              width="6"
              height="11"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span>{micState === "listening" ? "Ouvindo..." : "Falar"}</span>
        </button>
      ) : null}

      {micState === "denied" || micState === "silent" || micState === "failed" ? (
        <p className="alert alert--warn" role="status">
          {MIC_MESSAGES[micState]}
        </p>
      ) : null}

      {!canListen && !isResolved ? (
        <>
          <p className="alert alert--warn" role="status">
            {!isRecognitionSupported()
              ? "Este navegador nao reconhece fala. Ouca, repita em voz alta e confirme para continuar."
              : "O microfone so funciona em HTTPS ou localhost. Abrindo pelo IP da rede em " +
                "http://, o navegador bloqueia a captura. Ouca, repita em voz alta e " +
                "confirme para continuar."}
          </p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => onResolve(true)}
          >
            Repeti a frase
          </button>
        </>
      ) : null}

      {canListen && isResolved ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={retryRecording}
        >
          Tentar novamente
        </button>
      ) : null}

      {isResolved && heard !== null ? (
        <div className="exercise__feedback">
          <p className="exercise__hint">
            Ouvi: &ldquo;{heard || "nada"}&rdquo; ({Math.round(score * 100)}% de
            semelhanca)
          </p>
        </div>
      ) : null}
    </div>
  );
}

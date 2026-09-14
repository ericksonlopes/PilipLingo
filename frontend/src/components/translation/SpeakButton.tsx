/**
 * SpeakButton — botão de TTS genérico com suporte a idioma e feedback visual.
 *
 * Estados:
 *  - idle     → ícone de alto-falante
 *  - playing  → ícone de stop (quadrado), animação de pulse
 *  - error    → ícone de alto-falante riscado por 2 s, depois volta ao idle
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { isSpeechSupported, speakLang, stopSpeaking } from "../../lib/speech";

type SpeakState = "idle" | "playing" | "error";

interface SpeakButtonProps {
  text: string;
  /** BCP-47: "en-US" | "pt-BR" */
  lang: string;
  /** Rótulo acessível exibido ao lado do ícone */
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function SpeakButton({
  text,
  lang,
  label,
  className = "speak-btn",
  disabled = false,
}: SpeakButtonProps) {
  const [state, setState] = useState<SpeakState>("idle");
  const errorTimer = useRef<number | null>(null);

  // Limpa timer ao desmontar
  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current); }, []);

  const handleClick = useCallback(async () => {
    if (!isSpeechSupported()) return;

    if (state === "playing") {
      stopSpeaking();
      setState("idle");
      return;
    }

    setState("playing");
    const result = await speakLang(text, lang);

    if (result === "ended") {
      setState("idle");
    } else if (result === "cancelled") {
      setState("idle");
    } else if (result === "error") {
      setState("error");
      errorTimer.current = window.setTimeout(() => setState("idle"), 2000);
    }
    // "unsupported" não deve ocorrer pois verificamos antes
  }, [state, text, lang]);

  if (!isSpeechSupported()) return null;

  const ariaLabel =
    state === "playing"
      ? `Parar áudio${label ? ` — ${label}` : ""}`
      : `Ouvir${label ? ` — ${label}` : ""}`;

  return (
    <button
      type="button"
      className={`${className}${state === "playing" ? ` ${className}--playing` : ""}${state === "error" ? ` ${className}--error` : ""}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {state === "playing" ? <IconStop /> : state === "error" ? <IconMuted /> : <IconSpeaker />}
      {label && <span className="speak-btn__label">{label}</span>}
    </button>
  );
}

function IconSpeaker() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9c1.2 1 1.2 5 0 6M18 6.5c2.2 2 2.2 9 0 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="2"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

function IconMuted() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line
        x1="17"
        y1="7"
        x2="23"
        y2="17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

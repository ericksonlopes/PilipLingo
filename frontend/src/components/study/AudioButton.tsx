import { isSpeechSupported, speak } from "../../lib/speech";

interface AudioButtonProps {
  text: string;
  label?: string;
  /** Metade da velocidade ajuda a destrinchar a frase no ditado. */
  slow?: boolean;
  disabled?: boolean;
}

/** Toca a frase em ingles com a voz do proprio navegador. */
export default function AudioButton({
  text,
  label = "Ouvir",
  slow = false,
  disabled = false,
}: AudioButtonProps) {
  if (!isSpeechSupported()) {
    return (
      <p className="alert alert--warn" role="status">
        Este navegador nao consegue falar a frase. Use a traducao como apoio.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="btn btn--ghost audio-btn"
      disabled={disabled}
      onClick={() => void speak(text, slow ? 0.65 : 1)}
    >
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
      <span>{label}</span>
    </button>
  );
}

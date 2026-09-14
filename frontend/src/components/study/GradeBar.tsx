import { useEffect, useRef } from "react";

interface GradeBarProps {
  isSaving: boolean;
  autoAdvance: boolean;
  onAutoAdvanceChange: (enabled: boolean) => void;
  onContinue: () => void;
}

/** Avanco da sessao depois que a correcao automatica definiu a nota. */
export default function GradeBar({
  isSaving,
  autoAdvance,
  onAutoAdvanceChange,
  onContinue,
}: GradeBarProps) {
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => continueButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="continue-area" role="region" aria-label="Ações após a correção">
      <label className="switch continue-area__switch">
        <input
          type="checkbox"
          role="switch"
          checked={autoAdvance}
          onChange={(event) => onAutoAdvanceChange(event.target.checked)}
        />
        <span>Avançar automaticamente</span>
      </label>
      <button
        ref={continueButtonRef}
        type="button"
        className="btn btn--primary btn--block"
        onClick={onContinue}
        disabled={isSaving}
      >
        {isSaving ? "Salvando..." : "Continuar"}
      </button>
    </div>
  );
}

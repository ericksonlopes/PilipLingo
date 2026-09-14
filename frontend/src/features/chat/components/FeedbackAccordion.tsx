/**
 * Acordeão colapsável exibindo o feedback pedagógico de um turno.
 * Fechado por padrão, como especificado nos requisitos.
 */
import { useState } from "react";

import type { TurnFeedback } from "../../../lib/types";

interface FeedbackAccordionProps {
  feedback: TurnFeedback;
}

export default function FeedbackAccordion({ feedback }: FeedbackAccordionProps) {
  const [open, setOpen] = useState(false);

  const hasContent =
    feedback.corrections.length > 0 || feedback.suggestion;

  if (!hasContent) return null;

  return (
    <div className="feedback-accordion">
      <button
        type="button"
        className="feedback-accordion__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="feedback-panel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M9 18l6-6-6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{ transform: open ? "rotate(90deg)" : "none", transformOrigin: "center" }}
          />
        </svg>
        <span>Feedback pedagógico</span>
        <span className="feedback-accordion__count">
          {feedback.corrections.length > 0
            ? `${feedback.corrections.length} correção`
            : "dica"}
        </span>
      </button>

      {open && (
        <div id="feedback-panel" className="feedback-accordion__panel">
          {feedback.corrections.length > 0 && (
            <ul className="feedback-corrections">
              {feedback.corrections.map((c, i) => (
                <li key={i} className="feedback-correction">
                  <p className="feedback-correction__original">
                    ✗ {c.original}
                  </p>
                  <p className="feedback-correction__corrected">
                    ✓ {c.corrected}
                  </p>
                  <p className="feedback-correction__explanation">
                    {c.explanation}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {feedback.suggestion && (
            <p className="feedback-suggestion">
              💡 {feedback.suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

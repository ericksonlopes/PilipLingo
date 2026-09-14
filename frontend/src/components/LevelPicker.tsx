import { LEVEL_INFO } from "../lib/levels";
import { PROFICIENCY_LEVELS } from "../lib/types";
import type { ProficiencyLevel } from "../lib/types";

interface LevelPickerProps {
  current: ProficiencyLevel | null;
  onSelect: (level: ProficiencyLevel) => void;
  onCancel?: () => void;
}

/** Onboarding: o usuario informa o proprio nivel de ingles. */
export default function LevelPicker({ current, onSelect, onCancel }: LevelPickerProps) {
  return (
    <section className="level-picker" aria-labelledby="level-picker-title">
      <header className="level-picker__head">
        <h2 id="level-picker-title" className="level-picker__title">
          Qual o seu nivel de ingles?
        </h2>
        <p className="level-picker__text">
          Usamos isso para gerar frases e exemplos na medida certa. Voce pode mudar depois.
        </p>
      </header>

      <ul className="level-list">
        {PROFICIENCY_LEVELS.map((level) => {
          const info = LEVEL_INFO[level];
          const isCurrent = current === level;
          return (
            <li key={level}>
              <button
                type="button"
                className={`level-option${isCurrent ? " level-option--active" : ""}`}
                onClick={() => onSelect(level)}
                aria-current={isCurrent || undefined}
              >
                <span className={`level level--${level.toLowerCase()}`}>{level}</span>
                <span className="level-option__body">
                  <span className="level-option__label">{info.label}</span>
                  <span className="level-option__desc">{info.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {onCancel ? (
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
      ) : null}
    </section>
  );
}

/**
 * Tela de seleção de meta para modalidade GOAL.
 * Exibe lista de metas pré-definidas + campo de texto para meta customizada.
 */
import { useState } from "react";

import type { ChatGoal, ProficiencyLevel } from "../../../lib/types";

const MAX_CUSTOM_GOAL = 200;

interface GoalSelectorProps {
  goals: ChatGoal[];
  userLevel: ProficiencyLevel;
  onSelect: (goal: string) => void;
  onBack: () => void;
}

export default function GoalSelector({
  goals,
  userLevel,
  onSelect,
  onBack,
}: GoalSelectorProps) {
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  function handleSubmit() {
    const text = (selected ?? custom).trim();
    if (text) onSelect(text);
  }

  const canSubmit = (selected ?? custom.trim()).length > 0;

  return (
    <div className="chat-selector">
      <button
        type="button"
        className="btn btn--ghost btn--sm chat-selector__back"
        onClick={onBack}
        aria-label="Voltar para seleção de modalidade"
      >
        ← Voltar
      </button>
      <h2 className="chat-selector__title">Escolha uma meta</h2>
      <p className="chat-selector__subtitle">
        Selecione uma meta pré-definida ou escreva a sua própria.
      </p>

      {goals.length === 0 ? (
        <p className="chat-selector__empty">
          Nenhuma meta pré-definida disponível. Use o campo abaixo.
        </p>
      ) : (
        <ul className="chat-item-list" role="list">
          {goals.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className={`chat-item-card${selected === g.label ? " chat-item-card--selected" : ""}`}
                onClick={() => {
                  setSelected(g.label === selected ? null : g.label);
                  setCustom("");
                }}
                aria-pressed={selected === g.label}
              >
                <span className="chat-item-card__body">
                  <span className="chat-item-card__label">
                    {g.label}
                    {g.level_hint !== userLevel && (
                      <span className={`level level--${g.level_hint.toLowerCase()}`}>
                        {g.level_hint}
                      </span>
                    )}
                  </span>
                  <span className="chat-item-card__desc">{g.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="chat-selector__custom">
        <label className="field__label" htmlFor="custom-goal">
          Ou escreva sua meta:
        </label>
        <textarea
          id="custom-goal"
          className="field__input field__input--area"
          placeholder="Ex: Conseguir pedir informações sobre horários no aeroporto"
          maxLength={MAX_CUSTOM_GOAL}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setSelected(null);
          }}
          rows={3}
          autoCapitalize="sentences"
          spellCheck={false}
          aria-label="Meta personalizada"
        />
        <p className="chat-selector__char-count">
          {custom.length}/{MAX_CUSTOM_GOAL}
        </p>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        Iniciar conversa
      </button>
    </div>
  );
}
